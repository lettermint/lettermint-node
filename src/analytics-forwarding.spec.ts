import { Lettermint } from './lettermint';
import type * as Types from './types';

it('uses the new analytics and report forwarding contracts', async () => {
  const payload: Types.AnalyticsRequest = {
    metrics: ['accepted', 'delivered'],
    include: ['summary', 'time_series'],
    interval: 'day',
    filters: [{ dimension: 'project', operator: 'eq', values: ['project/id'] }],
    sort: { metric: 'accepted', direction: 'desc' },
    limit: 10,
  };
  const resource = { destination: null, verified: false, verified_at: null };
  const mockFetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: resource }) });
  global.fetch = mockFetch;
  const api = Lettermint.api('team-token');
  const analyticsResponse: Types.AnalyticsResponse = {
    data: { summary: { metrics: { accepted: 12, delivery_rate: null } } },
    meta: { timezone: 'UTC' },
    pagination: { total_groups: 0, returned_groups: 0, next_cursor: null, truncated: false },
  };
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => analyticsResponse });
  const analytics = await api.analytics(payload);
  expect(analytics.meta.timezone).toBe('UTC');
  expect(analytics.data.summary?.metrics?.delivery_rate).toBeNull();
  expect((await api.projects.retrieveReportForwarding('project/id')).data).toEqual(resource);
  await api.projects.updateReportForwarding('project/id', { destination: 'reports@example.com' });
  await api.projects.verifyReportForwarding('project/id', { code: '123456' });
  await api.projects.resendReportForwardingCode('project/id');
  const decode = jest.fn(() => {
    throw new Error('204 must not be decoded');
  });
  mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: decode });
  await expect(api.projects.deleteReportForwarding('project/id')).resolves.toBeUndefined();
  expect(decode).not.toHaveBeenCalled();
  const calls = mockFetch.mock.calls;
  expect(
    calls.map(([url, options]) => [url.replace('https://api.lettermint.co/v1', ''), options.method])
  ).toEqual([
    ['/analytics', 'POST'],
    ['/projects/project%2Fid/report-forwarding', 'GET'],
    ['/projects/project%2Fid/report-forwarding', 'PUT'],
    ['/projects/project%2Fid/report-forwarding/verify', 'POST'],
    ['/projects/project%2Fid/report-forwarding/resend-code', 'POST'],
    ['/projects/project%2Fid/report-forwarding', 'DELETE'],
  ]);
  expect(JSON.parse(calls[0][1].body)).toEqual(payload);
  expect(JSON.parse(calls[2][1].body)).toEqual({ destination: 'reports@example.com' });
  expect(JSON.parse(calls[3][1].body)).toEqual({ code: '123456' });
  for (const [, options] of calls) {
    expect(options.headers.Authorization).toBe('Bearer team-token');
    expect(options.headers).not.toHaveProperty('x-lettermint-token');
  }
});

it('keeps both suppression deletion results and project creation tokens', () => {
  const deleted: Types.SuppressionDestroyResponse = {
    success: true,
    message: 'Deleted',
    status: 'removed',
    confidence: 0.9,
  };
  const review: Types.SuppressionDestroyResponse = {
    success: true,
    message: 'Review',
    status: 'review_ticket_created',
    ticket_identifier: 'ticket-1',
  };
  const created: Types.ProjectStoreResponse = {
    data: {} as Types.ProjectData,
    message: 'Created',
    api_token: 'project-token',
  };
  expect(deleted.message).toBe('Deleted');
  expect(review.ticket_identifier).toBe('ticket-1');
  expect(created.api_token).toBe('project-token');
});
