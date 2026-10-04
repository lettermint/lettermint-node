import { inspect } from 'node:util';
import {
  ApiError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  LettermintConfigError,
  LettermintError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  RedirectError,
  ServerError,
  TimeoutError,
  UnexpectedResponseError,
  ValidationError,
} from '../src';
import { SENDING_TOKEN, TEAM_TOKEN, client, json, rejection, text } from './helpers';

const message = { from: 'a@example.test', to: ['b@example.test'], subject: 'x' };

async function sendError(response: () => Response | Promise<Response>, options = {}) {
  const { lettermint, fetch } = client(options, response);
  const error = await rejection(lettermint.emails.send(message));
  return { error, fetch };
}

function expectNoSecrets(error: Error) {
  for (const output of [
    inspect(error, { depth: Number.POSITIVE_INFINITY }),
    JSON.stringify(error),
    String(error.stack),
  ]) {
    expect(output).not.toContain(SENDING_TOKEN);
    expect(output).not.toContain(TEAM_TOKEN);
  }
}

describe('HTTP error mapping', () => {
  it.each([
    [400, ApiError, 'ApiError'],
    [401, AuthenticationError, 'AuthenticationError'],
    [403, PermissionError, 'PermissionError'],
    [404, NotFoundError, 'NotFoundError'],
    [409, ConflictError, 'ConflictError'],
    [410, ApiError, 'ApiError'],
    [422, ValidationError, 'ValidationError'],
    [429, RateLimitError, 'RateLimitError'],
    [500, ServerError, 'ServerError'],
    [503, ServerError, 'ServerError'],
  ])('maps HTTP %i to %p', async (status, type, name) => {
    const body = {
      error: { code: 'SOME_CODE', message: 'Something went wrong.', details: { a: 1 } },
    };
    const { error, fetch } = await sendError(() => json(status, body));
    expect(error).toBeInstanceOf(type);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(LettermintError);
    expect(error.name).toBe(name);
    expect(error).toMatchObject({
      status,
      code: 'SOME_CODE',
      message: 'Something went wrong.',
      details: { a: 1 },
      body,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expectNoSecrets(error);
  });

  it('reads Laravel validation errors', async () => {
    const body = {
      message: 'The to field is required.',
      errors: { to: ['The to field is required.'] },
    };
    const { error } = await sendError(() => json(422, body));
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      status: 422,
      code: undefined,
      message: 'The to field is required.',
      errors: { to: ['The to field is required.'] },
      body,
    });
  });

  it('keeps the legacy string error code', async () => {
    const body = { error: 'DailyLimitExceeded', message: 'Daily limit exceeded' };
    const { error } = await sendError(() => json(422, body));
    expect(error).toMatchObject({ code: 'DailyLimitExceeded', message: 'Daily limit exceeded' });
  });

  it('keeps the Free-plan Sandbox 403 response', async () => {
    const body = {
      error: {
        code: 'FEATURE_NOT_AVAILABLE',
        message: 'Sandbox mode is available only on paid plans.',
      },
    };
    const { error } = await sendError(() => json(403, body));
    expect(error).toBeInstanceOf(PermissionError);
    expect(error).toMatchObject({ status: 403, code: 'FEATURE_NOT_AVAILABLE', body });
  });

  it('falls back to the status text for an empty error body', async () => {
    const { error } = await sendError(
      () => new Response(null, { status: 404, statusText: 'Not Found' })
    );
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, message: 'Not Found', body: undefined });
    const { error: noText } = await sendError(() => new Response('', { status: 500 }));
    expect(noText).toMatchObject({ name: 'ServerError', message: 'HTTP 500' });
  });

  it.each([
    ['120', 120],
    ['0', 0],
    ['soon', undefined],
  ])('reads Retry-After %p', async (header, expected) => {
    const { error } = await sendError(() =>
      json(429, { message: 'Too Many Attempts.' }, { 'Retry-After': header })
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(expected);
  });

  it('reads an HTTP-date Retry-After', async () => {
    const date = new Date(Date.now() + 61_000).toUTCString();
    const { error } = await sendError(() =>
      json(429, { message: 'Slow down' }, { 'Retry-After': date })
    );
    expect((error as RateLimitError).retryAfter).toBeGreaterThanOrEqual(59);
    expect((error as RateLimitError).retryAfter).toBeLessThanOrEqual(61);
  });

  it('does not retry automatically', async () => {
    const { error, fetch } = await sendError(() => json(503, { message: 'Down' }));
    expect(error).toBeInstanceOf(ServerError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('unexpected responses', () => {
  it('raises a typed error with the status for an empty 2xx body', async () => {
    const { error } = await sendError(
      () => new Response('', { status: 202, headers: { 'Content-Type': 'application/json' } })
    );
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error.name).toBe('UnexpectedResponseError');
    expect(error).toMatchObject({ status: 202, bodyExcerpt: '' });
  });

  it('raises a typed error for an invalid JSON 2xx body', async () => {
    const { error } = await sendError(() => text(200, '{"message_id":'));
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error).toMatchObject({ status: 200, bodyExcerpt: '{"message_id":' });
  });

  it('raises a typed error with the status and an excerpt for an HTML 502', async () => {
    const page = `<html><head><title>502 Bad Gateway</title></head><body>${'x'.repeat(500)}</body></html>`;
    const { error } = await sendError(() =>
      text(502, page, { 'Content-Type': 'text/html; charset=UTF-8' })
    );
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error).toMatchObject({ status: 502 });
    expect(error.message).toContain('HTTP 502');
    expect(error.message).toContain('text/html');
    const excerpt = (error as UnexpectedResponseError).bodyExcerpt;
    expect(excerpt.startsWith('<html><head><title>502 Bad Gateway')).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(201);
  });

  it('accepts unknown enum values and fields', async () => {
    const { lettermint } = client({}, () =>
      json(202, {
        message_id: 'm',
        status: 'some_future_status',
        some_future_field: { nested: [1] },
      })
    );
    await expect(lettermint.emails.send(message)).resolves.toEqual({
      message_id: 'm',
      status: 'some_future_status',
      some_future_field: { nested: [1] },
    });
  });

  it('resolves 204 responses with undefined without decoding', async () => {
    const { lettermint } = client({}, () => new Response(null, { status: 204 }));
    await expect(lettermint.projects.reportForwarding.delete('p')).resolves.toBeUndefined();
  });

  it('returns text endpoints as strings', async () => {
    const source = 'From: a@example.test\r\nSubject: x\r\n\r\nBody\r\n';
    const { lettermint } = client({}, () =>
      text(200, source, { 'Content-Type': 'message/rfc822' })
    );
    await expect(lettermint.messages.source('m')).resolves.toBe(source);
    await expect(lettermint.messages.html('m')).resolves.toBe(source);
    await expect(lettermint.messages.text('m')).resolves.toBe(source);
  });
});

describe('redirects', () => {
  it.each([301, 302, 303, 307, 308])(
    'raises RedirectError for HTTP %i and never follows it',
    async (status) => {
      const { error, fetch } = await sendError(
        () =>
          new Response('{"message":"Moved"}', {
            status,
            headers: { Location: 'https://user:secret@attacker.example.test/v1/send?token=x' },
          })
      );
      expect(error).toBeInstanceOf(RedirectError);
      expect(error.name).toBe('RedirectError');
      expect((error as RedirectError).status).toBe(status);
      expect(error.message).not.toContain('attacker');
      expect(JSON.stringify(error)).not.toContain('attacker');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].redirect).toBe('manual');
    }
  );

  it('raises RedirectError for opaque redirect responses (browsers)', async () => {
    const opaque = {
      type: 'opaqueredirect',
      status: 0,
      body: null,
      headers: new Headers(),
    } as unknown as Response;
    const { error } = await sendError(() => opaque);
    expect(error).toBeInstanceOf(RedirectError);
    expect((error as RedirectError).status).toBe(0);
  });

  it('applies to the Team API', async () => {
    const { lettermint } = client(
      {},
      () => new Response('', { status: 307, headers: { Location: '/elsewhere' } })
    );
    await expect(lettermint.ping()).rejects.toBeInstanceOf(RedirectError);
  });
});

describe('timeouts, cancellation and network failures', () => {
  it('times out while waiting for the response headers', async () => {
    const { lettermint } = client(
      { timeout: 20 },
      (request) =>
        new Promise<Response>((_, reject) => {
          request.init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const error = await rejection(lettermint.emails.send(message));
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.name).toBe('TimeoutError');
    expect((error as TimeoutError).timeout).toBe(20);
  });

  it('times out when fetch ignores the abort signal', async () => {
    const { lettermint } = client({ timeout: 20 }, () => new Promise<Response>(() => {}));
    await expect(lettermint.emails.send(message)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('times out while reading the body', async () => {
    let cancelled = false;
    const { lettermint } = client({ timeout: 30 }, () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"message_id":'));
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream, { status: 202, headers: { 'Content-Type': 'application/json' } });
    });
    const error = await rejection(lettermint.emails.send(message));
    expect(error).toBeInstanceOf(TimeoutError);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(cancelled).toBe(true);
  });

  it('uses a per-call timeout', async () => {
    const { lettermint } = client({ timeout: 60_000 }, () => new Promise<Response>(() => {}));
    await expect(lettermint.emails.send(message, { timeout: 10 })).rejects.toMatchObject({
      name: 'TimeoutError',
      timeout: 10,
    });
  });

  it('rethrows the reason of a user abort', async () => {
    const controller = new AbortController();
    const { lettermint } = client({}, () => new Promise<Response>(() => {}));
    const pending = lettermint.emails.send(message, { signal: controller.signal });
    const reason = new Error('user cancelled');
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);

    const aborted = AbortSignal.abort();
    const { lettermint: other, fetch } = client();
    const error = await rejection(other.domains.list(undefined, { signal: aborted }));
    expect(error.name).toBe('AbortError');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an invalid signal', async () => {
    const { lettermint } = client();
    await expect(
      lettermint.domains.list(undefined, { signal: {} as AbortSignal })
    ).rejects.toBeInstanceOf(LettermintConfigError);
  });

  it('wraps network failures in ConnectionError', async () => {
    const cause = new TypeError('fetch failed');
    const { error } = await sendError(() => Promise.reject(cause));
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.name).toBe('ConnectionError');
    expect(error.message).toBe('Could not reach the Lettermint API: fetch failed');
    expect(error.cause).toBe(cause);
    expectNoSecrets(error);
  });

  it('wraps a failing body stream in ConnectionError', async () => {
    const { error } = await sendError(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError('terminated'));
            },
          }),
          { status: 202 }
        )
    );
    expect(error).toBeInstanceOf(ConnectionError);
  });
});
