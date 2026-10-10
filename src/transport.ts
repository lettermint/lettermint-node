import { version } from '../package.json';
import {
  ApiError,
  type ApiErrorInit,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  LettermintConfigError,
  LettermintValidationError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  RedirectError,
  ServerError,
  TimeoutError,
  UnexpectedResponseError,
  ValidationError,
} from './errors';
import {
  type OperationKey,
  type OperationQuery,
  type OperationRequest,
  type OperationResponse,
  operations,
} from './generated/operations';
import { type NestedQuery, serializeQuery, withQueryParam } from './query';

/** Per-call options accepted by every SDK method that makes a request. */
export interface RequestOptions {
  /** Cancels the request. The SDK rethrows the signal's `reason`. */
  signal?: AbortSignal;
  /** Overrides the client's timeout for this call, in milliseconds. */
  timeout?: number;
}

/** Options of calls that accept an `Idempotency-Key`. */
export interface IdempotentRequestOptions extends RequestOptions {
  /**
   * Sent as the `Idempotency-Key` header. Retrying with the same key does not
   * send the email again. Never stored on the client.
   */
  idempotencyKey?: string;
}

/** A `fetch`-compatible function. */
export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export const DEFAULT_BASE_URL = 'https://api.lettermint.co/v1';
export const DEFAULT_TIMEOUT = 30_000;
export const USER_AGENT = `lettermint-node/${version}`;

export type AuthChoice = 'sending' | 'team' | 'either';

export interface CallArgs<K extends OperationKey = OperationKey> {
  /** The public method name, used in error messages (`domains.list`). */
  label: string;
  path?: Record<string, string>;
  query?: OperationQuery<K> extends undefined ? undefined : NestedQuery<OperationQuery<K>>;
  body?: OperationRequest<K>;
  idempotencyKey?: string;
  /** Overrides the auth surface from the operation table. */
  auth?: AuthChoice;
  options?: RequestOptions;
}

export interface TransportConfig {
  sendingToken: string | undefined;
  teamToken: string | undefined;
  baseUrl: string;
  timeout: number;
  fetch: FetchFunction;
}

/** Page shape shared by every cursor-paginated list. */
interface CursorPageLike<T> {
  data: T[];
  next_cursor: string | null;
}

// Browsers ignore or reject a custom User-Agent, so the header is only set elsewhere.
const IS_BROWSER =
  typeof (globalThis as { window?: unknown }).window !== 'undefined' &&
  typeof (globalThis as { document?: unknown }).document !== 'undefined';

const HEADER_VALUE = /^[^\r\n\0]+$/;

export function checkTimeout(value: unknown, option = 'timeout'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new LettermintConfigError(`\`${option}\` must be a positive number of milliseconds.`);
  }
  return value;
}

export function checkBaseUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new LettermintConfigError('`baseUrl` must be a string.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LettermintConfigError('`baseUrl` must be an absolute http(s) URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new LettermintConfigError('`baseUrl` must be an absolute http(s) URL.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new LettermintConfigError(
      '`baseUrl` must not contain credentials, a query string or a fragment.'
    );
  }
  return url.href.replace(/\/+$/, '');
}

function encodePathParam(label: string, name: string, value: unknown): string {
  if (typeof value !== 'string' || value === '' || value === '.' || value === '..') {
    throw new LettermintConfigError(
      `${label}: \`${name}\` must be a non-empty string other than "." and "..".`
    );
  }
  return encodeURIComponent(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AbortSignal).aborted === 'boolean' &&
    typeof (value as AbortSignal).addEventListener === 'function'
  );
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function createApiError(response: Response, body: unknown): ApiError {
  const { status } = response;
  const init: ApiErrorInit = { status, message: '', body };
  let errors: Record<string, string[]> | undefined;
  if (isObject(body)) {
    const error = body.error;
    if (isObject(error)) {
      if (typeof error.code === 'string') init.code = error.code;
      if (typeof error.message === 'string') init.message = error.message;
      init.details = error.details;
    } else if (typeof error === 'string') {
      init.code = error;
    }
    if (!init.message && typeof body.message === 'string') init.message = body.message;
    if (isObject(body.errors)) errors = body.errors as Record<string, string[]>;
  }
  if (!init.message) init.message = response.statusText || `HTTP ${status}`;

  switch (status) {
    case 401:
      return new AuthenticationError(init);
    case 403:
      return new PermissionError(init);
    case 404:
      return new NotFoundError(init);
    case 409:
      return new ConflictError(init);
    case 422:
      return new ValidationError({ ...init, errors });
    case 429:
      return new RateLimitError({
        ...init,
        retryAfter: parseRetryAfter(response.headers.get('retry-after')),
      });
    default:
      return status >= 500
        ? new ServerError({
            ...init,
            retryAfter: parseRetryAfter(response.headers.get('retry-after')),
          })
        : new ApiError(init);
  }
}

/** Rejects with `signal.reason` when the signal aborts, even if `promise` ignores the signal. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    promise.catch(() => {});
    return Promise.reject(signal.reason);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/** Reads the body as text; on abort, cancels the stream and rejects with the signal's reason. */
async function readText(response: Response, signal: AbortSignal): Promise<string> {
  const body = response.body;
  if (!body || typeof body.getReader !== 'function') return abortable(response.text(), signal);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    reader.cancel().catch(() => {});
    throw error;
  }
}

function discardBody(response: Response): void {
  try {
    response.body?.cancel().catch(() => {});
  } catch {
    // The body is locked or already consumed.
  }
}

/**
 * Sends requests for one client. Holds the tokens in private fields; nothing
 * else in the SDK can read them.
 */
export class Transport {
  readonly #sendingToken: string | undefined;
  readonly #teamToken: string | undefined;
  readonly #fetch: FetchFunction;
  readonly baseUrl: string;
  readonly timeout: number;

  constructor(config: TransportConfig) {
    this.#sendingToken = config.sendingToken;
    this.#teamToken = config.teamToken;
    this.#fetch = config.fetch;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
  }

  get hasSendingToken(): boolean {
    return this.#sendingToken !== undefined;
  }

  get hasTeamToken(): boolean {
    return this.#teamToken !== undefined;
  }

  /** Throws if the token for `auth` is not configured. */
  assertAuth(label: string, auth: AuthChoice): void {
    this.#authHeader(label, auth);
  }

  #authHeader(label: string, auth: AuthChoice): [string, string] {
    const useTeam = auth === 'team' || (auth === 'either' && this.#teamToken !== undefined);
    if (useTeam) {
      if (this.#teamToken === undefined) {
        throw new LettermintConfigError(
          `${label} needs \`teamToken\`; pass it as new Lettermint({ teamToken }).`
        );
      }
      return ['Authorization', `Bearer ${this.#teamToken}`];
    }
    if (this.#sendingToken === undefined) {
      throw new LettermintConfigError(
        `${label} needs \`sendingToken\`; pass it as new Lettermint({ sendingToken }).`
      );
    }
    return ['x-lettermint-token', this.#sendingToken];
  }

  async call<K extends OperationKey>(key: K, args: CallArgs<K>): Promise<OperationResponse<K>> {
    const operation = operations[key];
    const { label, options } = args;

    const [authName, authValue] = this.#authHeader(label, args.auth ?? operation.auth);
    const path = operation.path.replace(/\{(\w+)\}/g, (_, name: string) =>
      encodePathParam(label, name, args.path?.[name])
    );
    if (options !== undefined && !isObject(options)) {
      throw new LettermintConfigError(`${label}: the options argument must be an object.`);
    }
    const timeout = options?.timeout === undefined ? this.timeout : checkTimeout(options.timeout);
    const signal = options?.signal;
    if (signal !== undefined && !isAbortSignal(signal)) {
      throw new LettermintConfigError(`${label}: \`signal\` must be an AbortSignal.`);
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!IS_BROWSER) headers['User-Agent'] = USER_AGENT;
    if (args.idempotencyKey !== undefined) {
      if (typeof args.idempotencyKey !== 'string' || !HEADER_VALUE.test(args.idempotencyKey)) {
        throw new LettermintValidationError(
          '`idempotencyKey` must be a non-empty string without line breaks.',
          'idempotencyKey'
        );
      }
      headers['Idempotency-Key'] = args.idempotencyKey;
    }
    let body: string | undefined;
    if (args.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(args.body);
    }
    headers[authName] = authValue;

    const query = serializeQuery(args.query);
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;

    if (signal?.aborted) throw signal.reason;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const rethrow = (error: unknown): never => {
      if (timedOut) throw new TimeoutError(timeout);
      if (signal?.aborted) throw signal.reason;
      throw new ConnectionError(error);
    };

    try {
      const fetchFunction = this.#fetch;
      let response: Response;
      try {
        response = await abortable(
          fetchFunction(url, {
            method: operation.method,
            headers,
            body,
            redirect: 'manual',
            signal: controller.signal,
          }),
          controller.signal
        );
      } catch (error) {
        return rethrow(error);
      }

      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        discardBody(response);
        throw new RedirectError(response.type === 'opaqueredirect' ? 0 : response.status);
      }

      let text: string;
      try {
        text = await readText(response, controller.signal);
      } catch (error) {
        return rethrow(error);
      }
      return decode(operation.response.type, response, text) as OperationResponse<K>;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /** Follows `next_cursor` through every page of a cursor-paginated list. */
  async *paginate<T, K extends OperationKey = OperationKey>(
    key: K,
    args: CallArgs<K>
  ): AsyncGenerator<T, void, undefined> {
    const cursorParam = operations[key].pagination?.cursorParam;
    if (!cursorParam) throw new Error(`${key} is not cursor-paginated`);
    let query = args.query;
    const seen = new Set<string>();
    while (true) {
      const page = (await this.call(key, {
        ...args,
        query,
      } as CallArgs<K>)) as unknown as CursorPageLike<T>;
      if (!isObject(page) || !Array.isArray(page.data)) {
        throw new UnexpectedResponseError(
          `${args.label}: the API returned a page without a data array.`,
          200,
          JSON.stringify(page) ?? ''
        );
      }
      yield* page.data;
      const next = page.next_cursor;
      if (typeof next !== 'string' || next === '' || seen.has(next)) return;
      seen.add(next);
      query = withQueryParam(args.query, cursorParam, next) as CallArgs<K>['query'];
    }
  }
}

function decode(type: string, response: Response, text: string): unknown {
  const { status } = response;
  if (status >= 200 && status < 300) {
    if (type === 'empty' || status === 204 || status === 205) return undefined;
    if (type === 'text') return text;
    if (text.trim() === '') {
      throw new UnexpectedResponseError(
        `The Lettermint API answered with HTTP ${status} and an empty body where JSON was expected.`,
        status,
        text
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new UnexpectedResponseError(
        `The Lettermint API answered with HTTP ${status} and a body that is not valid JSON.`,
        status,
        text
      );
    }
  }
  if (status < 400) {
    throw new UnexpectedResponseError(
      `The Lettermint API answered with an unexpected HTTP status ${status}.`,
      status,
      text
    );
  }
  let body: unknown;
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text);
    } catch {
      const contentType = response.headers.get('content-type');
      throw new UnexpectedResponseError(
        `The Lettermint API answered with HTTP ${status} and a body that is not JSON${contentType ? ` (${contentType.split(';')[0]})` : ''}.`,
        status,
        text
      );
    }
  }
  throw createApiError(response, body);
}
