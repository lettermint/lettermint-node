/**
 * Error classes of the Lettermint SDK.
 *
 * Every class sets an explicit `name`, so `error.name` stays readable in logs
 * and bundles. No error carries request headers or API tokens.
 */

/** Base class of every error the SDK throws. */
export class LettermintError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LettermintError';
  }
}

/**
 * The client was configured or called incorrectly: a missing or unrecognised
 * token, a token that the called method cannot use, an invalid option or an
 * invalid path parameter. Thrown before any request is made.
 */
export class LettermintConfigError extends LettermintError {
  constructor(message: string) {
    super(message);
    this.name = 'LettermintConfigError';
  }
}

/**
 * The SDK rejected a request before sending it, for example invalid message
 * tags. Unlike {@link ValidationError}, the API never saw this request.
 */
export class LettermintValidationError extends LettermintError {
  /** The offending field, for example `tags` or `messages[2].tags`. */
  public readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'LettermintValidationError';
    this.field = field;
  }
}

/** Fields of an {@link ApiError}. */
export interface ApiErrorInit {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
  body?: unknown;
}

/**
 * The API answered with an error status (4xx or 5xx) and a JSON or empty body.
 * Subclasses cover the common statuses.
 */
export class ApiError extends LettermintError {
  /** The HTTP status code. */
  public readonly status: number;
  /** Machine-readable error code from `{ error: { code } }`, if the API sent one. */
  public readonly code: string | undefined;
  /** Additional context from `{ error: { details } }`, if the API sent any. */
  public readonly details: unknown;
  /** The decoded JSON error body, or `undefined` for an empty body. */
  public readonly body: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.body = init.body;
  }
}

/** HTTP 401: the token is missing, invalid or revoked. */
export class AuthenticationError extends ApiError {
  constructor(init: ApiErrorInit) {
    super(init);
    this.name = 'AuthenticationError';
  }
}

/** HTTP 403: the token may not perform this action, or the plan lacks the feature. */
export class PermissionError extends ApiError {
  constructor(init: ApiErrorInit) {
    super(init);
    this.name = 'PermissionError';
  }
}

/** HTTP 404: the resource does not exist or is not visible to the token. */
export class NotFoundError extends ApiError {
  constructor(init: ApiErrorInit) {
    super(init);
    this.name = 'NotFoundError';
  }
}

/** HTTP 409: the request conflicts with the current state, for example an Idempotency-Key reused with a different body. */
export class ConflictError extends ApiError {
  constructor(init: ApiErrorInit) {
    super(init);
    this.name = 'ConflictError';
  }
}

/** HTTP 422: the API rejected the request data. */
export class ValidationError extends ApiError {
  /** Field errors from the `{ message, errors }` body, when the API sent them. */
  public readonly errors: Record<string, string[]> | undefined;

  constructor(init: ApiErrorInit & { errors?: Record<string, string[]> }) {
    super(init);
    this.name = 'ValidationError';
    this.errors = init.errors;
  }
}

/** HTTP 429: too many requests. */
export class RateLimitError extends ApiError {
  /** Seconds to wait, from the `Retry-After` header, when the API sent one. */
  public readonly retryAfter: number | undefined;

  constructor(init: ApiErrorInit & { retryAfter?: number }) {
    super(init);
    this.name = 'RateLimitError';
    this.retryAfter = init.retryAfter;
  }
}

/** HTTP 5xx with a JSON or empty body. */
export class ServerError extends ApiError {
  /** Seconds to wait, from the `Retry-After` header, when the API sent one. */
  public readonly retryAfter: number | undefined;

  constructor(init: ApiErrorInit & { retryAfter?: number }) {
    super(init);
    this.name = 'ServerError';
    this.retryAfter = init.retryAfter;
  }
}

/**
 * The request did not complete within the timeout. The timeout covers the
 * response headers and the body. The API may still have processed the request.
 */
export class TimeoutError extends LettermintError {
  /** The timeout in milliseconds. */
  public readonly timeout: number;

  constructor(timeout: number) {
    super(`The request to the Lettermint API timed out after ${timeout} ms.`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/** The request could not be sent or the connection failed (DNS, TLS, refused, reset). */
export class ConnectionError extends LettermintError {
  constructor(cause: unknown) {
    const reason = cause instanceof Error && cause.message ? `: ${cause.message}` : '';
    super(`Could not reach the Lettermint API${reason}`, { cause });
    this.name = 'ConnectionError';
  }
}

/**
 * The response could not be decoded: an empty or non-JSON body where JSON was
 * expected, or an error status with a non-JSON body such as a proxy's HTML page.
 */
export class UnexpectedResponseError extends LettermintError {
  /** The HTTP status code. */
  public readonly status: number;
  /** The first 200 characters of the response body. */
  public readonly bodyExcerpt: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'UnexpectedResponseError';
    this.status = status;
    this.bodyExcerpt = body.length > 200 ? `${body.slice(0, 200)}…` : body;
  }
}

/**
 * The API answered with a redirect (3xx). The SDK never follows redirects, so
 * that tokens are not sent to another location.
 */
export class RedirectError extends LettermintError {
  /** The HTTP status code, or 0 when the runtime hides the redirect (browsers). */
  public readonly status: number;

  constructor(status: number) {
    super(
      `The Lettermint API answered with a redirect${status ? ` (HTTP ${status})` : ''}. Redirects are not followed; check the baseUrl option.`
    );
    this.name = 'RedirectError';
    this.status = status;
  }
}

/** Why a webhook delivery failed verification. */
export type WebhookVerificationReason =
  | 'signature_header_missing'
  | 'signature_header_malformed'
  | 'delivery_header_missing'
  | 'delivery_timestamp_mismatch'
  | 'timestamp_out_of_tolerance'
  | 'signature_mismatch'
  | 'body_invalid'
  | 'payload_invalid';

/** A webhook delivery could not be verified. Reject the request; do not process its payload. */
export class WebhookVerificationError extends LettermintError {
  /** A machine-readable reason. */
  public readonly reason: WebhookVerificationReason;

  constructor(reason: WebhookVerificationReason, message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
    this.reason = reason;
  }
}
