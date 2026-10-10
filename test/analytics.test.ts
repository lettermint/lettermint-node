import { type AnalyticsQuery, type AnalyticsResponse, ServerError, ValidationError } from '../src';
import pageOne from './fixtures/analytics-page-1.json';
import pageTwo from './fixtures/analytics-page-2.json';
import summaryOnly from './fixtures/analytics-summary.json';
import { client, json, rejection } from './helpers';

const query: AnalyticsQuery = {
  metrics: ['delivered', 'bounced', 'delivery_rate', 'delivery_latency_p50_ms'],
  include: ['summary', 'time_series', 'breakdown'],
  group_by: ['recipient_domain'],
  interval: 'hour',
  timezone: 'Asia/Kolkata',
  compare: 'previous_period',
  limit: 2,
};

describe('analytics responses', () => {
  it('keeps null values, empty rate bases and both timestamp formats', async () => {
    const { lettermint, requests } = client({}, () => json(200, pageOne));
    const result = await lettermint.analytics(query);

    expect(requests[0].body).toEqual(query);
    const summary = result.data.summary;
    expect(summary?.metrics).toEqual({
      delivered: 1200,
      bounced: 0,
      delivery_rate: 0.9836,
      delivery_latency_p50_ms: null,
    });
    expect(summary?.rate_bases.delivery_rate).toEqual({ numerator: 1200, denominator: 1220 });
    expect(summary?.previous?.rate_bases.delivery_rate).toEqual({
      numerator: null,
      denominator: null,
    });
    expect(summary?.change?.delivery_rate).toEqual({
      absolute: null,
      relative: null,
      percentage_points: null,
    });
    expect(summary?.change?.delivered).not.toHaveProperty('percentage_points');

    const [complete, unavailable] = result.data.time_series ?? [];
    expect(complete.from).toBe('2026-09-15T08:30:00+05:30');
    expect(new Date(complete.from).toISOString()).toBe('2026-09-15T03:00:00.000Z');
    expect(unavailable).toMatchObject({ available: false, partial: true, rate_bases: {} });
    expect(unavailable.metrics.delivered).toBeNull();

    expect(result.meta.generated_at).toBe('2026-09-15T04:12:30.482915Z');
    expect(new Date(result.meta.from).toISOString()).toBe('2026-09-15T03:00:00.000Z');
    expect(result.meta.last_ingested_at).toBeNull();
    expect(result.meta.comparison).toEqual({
      from: '2026-09-15T01:00:00.000000Z',
      to: '2026-09-15T03:00:00.000000Z',
      partial: false,
    });
    expect(result.pagination).toEqual({
      total_groups: 3,
      returned_groups: 2,
      next_cursor: 'cursor-page-2',
      truncated: false,
    });
  });

  it('leaves out the sections and comparison a query did not ask for', async () => {
    const { lettermint } = client({}, () => json(200, summaryOnly));
    const result = await lettermint.analytics({ metrics: ['delivered'] });
    expect(result.data.summary?.rate_bases).toEqual({});
    expect(result.data).not.toHaveProperty('time_series');
    expect(result.data).not.toHaveProperty('breakdown');
    expect(result.data.summary).not.toHaveProperty('previous');
    expect(result.meta).not.toHaveProperty('comparison');
    expect(result.pagination.next_cursor).toBeNull();
  });

  it('keeps a null dimension value in a breakdown row', async () => {
    const { lettermint } = client({}, () => json(200, pageTwo));
    const result = await lettermint.analytics({ ...query, cursor: 'cursor-page-2' });
    expect(result.data.breakdown).toHaveLength(1);
    expect(result.data.breakdown?.[0].dimensions).toEqual({ recipient_domain: null });
    expect(result.data.breakdown?.[0].metrics.bounced).toBeNull();
  });
});

describe('analyticsPages', () => {
  it('follows next_cursor and yields every response', async () => {
    const sent = { ...query };
    const { lettermint, requests } = client({}, (_, index) =>
      json(200, index === 0 ? pageOne : pageTwo)
    );
    const pages: AnalyticsResponse[] = [];
    for await (const page of lettermint.analyticsPages(sent)) pages.push(page);

    expect(pages).toHaveLength(2);
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.method === 'POST')).toBe(true);
    expect(requests.every((request) => request.path === '/analytics')).toBe(true);
    expect(requests[0].body).toEqual(query);
    expect(requests[1].body).toEqual({ ...query, cursor: 'cursor-page-2' });
    expect(sent).toEqual(query);

    const rows = pages.flatMap((page) => page.data.breakdown ?? []);
    expect(rows.map((row) => row.dimensions.recipient_domain)).toEqual([
      'gmail.com',
      'outlook.com',
      null,
    ]);
    expect(pages[1].pagination).toMatchObject({ returned_groups: 1, next_cursor: null });
  });

  it('makes one request for a query without more pages', async () => {
    const { lettermint, requests } = client({}, () => json(200, summaryOnly));
    const pages: AnalyticsResponse[] = [];
    for await (const page of lettermint.analyticsPages({ metrics: ['delivered'] }))
      pages.push(page);
    expect(pages).toHaveLength(1);
    expect(requests).toHaveLength(1);
  });

  it('requests the next page only when it is asked for', async () => {
    const { lettermint, requests } = client({}, () => json(200, pageOne));
    for await (const page of lettermint.analyticsPages(query)) {
      expect(page.pagination.next_cursor).toBe('cursor-page-2');
      break;
    }
    expect(requests).toHaveLength(1);
  });

  it('stops when the API repeats a cursor', async () => {
    const { lettermint, requests } = client({}, () => json(200, pageOne));
    let count = 0;
    for await (const _ of lettermint.analyticsPages(query)) count += 1;
    expect(count).toBe(2);
    expect(requests).toHaveLength(2);
  });

  it('stops when the API returns the cursor the query started from', async () => {
    const { lettermint, requests } = client({}, () => json(200, pageOne));
    let count = 0;
    for await (const _ of lettermint.analyticsPages({ ...query, cursor: 'cursor-page-2' }))
      count += 1;
    expect(count).toBe(1);
    expect(requests[0].body).toEqual({ ...query, cursor: 'cursor-page-2' });
  });

  it('passes request options to every page and surfaces an expired cursor', async () => {
    const body = {
      message: 'The analytics cursor is invalid or expired. Submit a new query.',
      errors: { cursor: ['The analytics cursor is invalid or expired. Submit a new query.'] },
    };
    const { lettermint, requests } = client({}, (_, index) =>
      index === 0 ? json(200, pageOne) : json(422, body)
    );
    const controller = new AbortController();
    const pages = lettermint.analyticsPages(query, { signal: controller.signal });
    expect((await pages.next()).done).toBe(false);
    const error = await rejection(pages.next());
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual(body.errors);
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.init.signal instanceof AbortSignal)).toBe(true);
  });
});

describe('analytics errors', () => {
  it('reads field errors from a 422', async () => {
    const body = {
      message: 'smtp_response_group can only be used in group_by.',
      errors: { filters: ['smtp_response_group can only be used in group_by.'] },
    };
    const { lettermint } = client({}, () => json(422, body));
    const error = await rejection(lettermint.analytics(query));
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 422, message: body.message, errors: body.errors });
  });

  it('reads Retry-After from a 503', async () => {
    const body = { error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again shortly.' } };
    const { lettermint } = client({}, () => json(503, body, { 'Retry-After': '2' }));
    const error = await rejection(lettermint.analytics(query));
    expect(error).toBeInstanceOf(ServerError);
    expect(error).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE', retryAfter: 2 });
  });

  it('has no retryAfter for a 503 or 504 without the header', async () => {
    const unavailable = client({}, () => json(503, { message: 'Analytics is unavailable.' }));
    const first = await rejection(unavailable.lettermint.analytics(query));
    expect(first).toBeInstanceOf(ServerError);
    expect((first as ServerError).retryAfter).toBeUndefined();

    const message =
      'Analytics exceeded the query time limit. Retry with a shorter period or fewer dimensions.';
    const timedOut = client({}, () => json(504, { message }));
    const second = await rejection(timedOut.lettermint.analytics(query));
    expect(second).toBeInstanceOf(ServerError);
    expect(second).toMatchObject({ status: 504, message });
    expect((second as ServerError).retryAfter).toBeUndefined();
  });
});
