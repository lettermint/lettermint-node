import { Lettermint, type LettermintOptions } from '../src';

export const SENDING_TOKEN = 'lm_sendingFixture0000000000000000';
export const TEAM_TOKEN = 'lm_team_teamFixture000000000000000000000000000';
export const BASE = 'https://api.lettermint.co/v1';

export interface RecordedRequest {
  url: string;
  path: string;
  query: URLSearchParams;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string | undefined;
  init: RequestInit;
}

export type Handler = (request: RecordedRequest, index: number) => Response | Promise<Response>;

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function text(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : body, { status, headers });
}

/** A fake fetch that records every request and answers with `handler` (default: `{}` 200). */
export function fakeFetch(handler: Handler = () => json(200, {})) {
  const requests: RecordedRequest[] = [];
  const fetch = jest.fn(async (url: string, init: RequestInit) => {
    const parsed = new URL(url);
    const rawBody = typeof init.body === 'string' ? init.body : undefined;
    const request: RecordedRequest = {
      url,
      path: parsed.pathname.replace(/^\/v1/, ''),
      query: parsed.searchParams,
      method: String(init.method),
      headers: { ...(init.headers as Record<string, string>) },
      body: rawBody === undefined ? undefined : JSON.parse(rawBody),
      rawBody,
      init,
    };
    requests.push(request);
    return handler(request, requests.length - 1);
  });
  return { fetch, requests };
}

export function client(options: Partial<LettermintOptions> = {}, handler?: Handler) {
  const { fetch, requests } = fakeFetch(handler);
  const lettermint = new Lettermint({
    sendingToken: SENDING_TOKEN,
    teamToken: TEAM_TOKEN,
    fetch,
    ...options,
  });
  return { lettermint, fetch, requests };
}

/** Resolves with the rejection of `promise`, or fails the test when it resolves. */
export async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected the promise to reject');
}

/** Returns the error thrown by `fn`, or fails the test when it does not throw. */
export function thrown(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected the function to throw');
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
