import { type BinaryInput, isBinary, toBytes, utf8 } from './encoding';
import { LettermintConfigError, WebhookVerificationError } from './errors';
import type { WebhookEvent } from './generated/types';
import { inspectCustom, renderInspect } from './redact';

/** Options of {@link Webhook}. */
export interface WebhookOptions {
  /**
   * Maximum difference between the signed timestamp and the current time, in
   * seconds, in either direction. Default 300. `0` accepts only the current second.
   */
  tolerance?: number;
}

/** Request headers: a Fetch `Headers` object or a Node.js-style header record. */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

/** The raw request body, exactly as received. */
export type WebhookBody = string | BinaryInput;

/** A verified webhook delivery. Unknown fields are kept. */
export interface WebhookPayload<TData = Record<string, unknown>> {
  /** The delivery id. */
  id?: string;
  /** The event name, for example `message.delivered`. Unknown events pass through as strings. */
  event: WebhookEvent;
  /** When the event occurred, ISO 8601. */
  timestamp: string;
  data: TData;
  [key: string]: unknown;
}

const SIGNATURE_HEADER = 'x-lettermint-signature';
const DELIVERY_HEADER = 'x-lettermint-delivery';
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const DIGITS = /^[0-9]+$/;
const HEX_SHA256 = /^[0-9a-fA-F]{64}$/;

type Lookup = { value: string } | { missing: true } | { ambiguous: true };

function readHeader(headers: WebhookHeaders, name: string): Lookup {
  if (headers && typeof (headers as Headers).get === 'function') {
    const value = (headers as Headers).get(name);
    return value === null ? { missing: true } : { value };
  }
  if (typeof headers !== 'object' || headers === null) return { missing: true };
  const values: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name || value === undefined) continue;
    if (Array.isArray(value)) values.push(...value);
    else values.push(value);
  }
  if (values.length === 0) return { missing: true };
  if (values.length > 1 || typeof values[0] !== 'string') return { ambiguous: true };
  return { value: values[0] };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

interface ParsedSignature {
  timestamp: string;
  signatures: Uint8Array[];
}

function parseSignatureHeader(header: string): ParsedSignature {
  const malformed = (detail: string) =>
    new WebhookVerificationError(
      'signature_header_malformed',
      `The signature header is malformed: ${detail}.`
    );
  if (!PRINTABLE_ASCII.test(header)) throw malformed('it contains non-ASCII or control characters');
  let timestamp: string | undefined;
  const signatures: Uint8Array[] = [];
  for (const part of header.split(',')) {
    const entry = part.trim();
    const separator = entry.indexOf('=');
    if (separator === -1) continue;
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (key === 't') {
      if (timestamp !== undefined) throw malformed('it has more than one timestamp');
      if (!DIGITS.test(value) || !Number.isSafeInteger(Number(value))) {
        throw malformed('the timestamp is not a number of seconds');
      }
      timestamp = value;
    } else if (key === 'v1' && HEX_SHA256.test(value)) {
      signatures.push(hexToBytes(value));
    }
  }
  if (timestamp === undefined) throw malformed('the timestamp (t=) is missing');
  if (signatures.length === 0) throw malformed('no v1 signature is present');
  return { timestamp, signatures };
}

function bodyBytes(body: unknown): Uint8Array {
  let bytes: Uint8Array | undefined;
  if (typeof body === 'string') bytes = utf8(body);
  else if (isBinary(body)) bytes = toBytes(body);
  if (!bytes) {
    throw new WebhookVerificationError(
      'body_invalid',
      'Pass the raw request body (string, Uint8Array or ArrayBuffer), not parsed JSON.'
    );
  }
  if (bytes.length === 0) {
    throw new WebhookVerificationError('body_invalid', 'The raw request body is empty.');
  }
  return bytes;
}

function getSubtle(): SubtleCrypto {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) {
    throw new LettermintConfigError(
      'Webhook verification needs the Web Crypto API (crypto.subtle).'
    );
  }
  return subtle;
}

/**
 * Verifies Lettermint webhook deliveries: an HMAC-SHA256 signature over
 * `"<t>." + raw body` with the endpoint's signing secret (`whsec_...`), checked
 * with Web Crypto and a constant-time comparison.
 */
export class Webhook {
  readonly #secret: string;
  readonly #tolerance: number;
  #key: Promise<CryptoKey> | undefined;

  constructor(secret: string, options: WebhookOptions = {}) {
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new LettermintConfigError('The webhook signing secret must be a non-empty string.');
    }
    const tolerance = options?.tolerance ?? 300;
    if (!Number.isSafeInteger(tolerance) || tolerance < 0) {
      throw new LettermintConfigError(
        '`tolerance` must be a non-negative whole number of seconds.'
      );
    }
    this.#secret = secret;
    this.#tolerance = tolerance;
  }

  /** The timestamp tolerance in seconds. */
  get tolerance(): number {
    return this.#tolerance;
  }

  /**
   * Verifies a delivery from its raw body and request headers, and returns the
   * decoded payload. Requires `X-Lettermint-Signature` and `X-Lettermint-Delivery`
   * (which must equal the signed timestamp). Header names are case-insensitive.
   *
   * @throws {WebhookVerificationError} when the delivery is not genuine.
   */
  async verify<TData = Record<string, unknown>>(
    rawBody: WebhookBody,
    headers: WebhookHeaders
  ): Promise<WebhookPayload<TData>> {
    const signature = readHeader(headers, SIGNATURE_HEADER);
    if ('missing' in signature) {
      throw new WebhookVerificationError(
        'signature_header_missing',
        'The X-Lettermint-Signature header is missing.'
      );
    }
    if ('ambiguous' in signature) {
      throw new WebhookVerificationError(
        'signature_header_malformed',
        'The request has more than one X-Lettermint-Signature header.'
      );
    }
    const delivery = readHeader(headers, DELIVERY_HEADER);
    if ('missing' in delivery) {
      throw new WebhookVerificationError(
        'delivery_header_missing',
        'The X-Lettermint-Delivery header is missing.'
      );
    }
    if ('ambiguous' in delivery) {
      throw new WebhookVerificationError(
        'delivery_timestamp_mismatch',
        'The request has more than one X-Lettermint-Delivery header.'
      );
    }
    return this.verifySignature<TData>(rawBody, signature.value, delivery.value);
  }

  /**
   * Verifies the raw body against an `X-Lettermint-Signature` value, for setups
   * where the headers are not at hand. When `timestamp` (the `X-Lettermint-Delivery`
   * value) is given, it must equal the signed timestamp.
   *
   * @throws {WebhookVerificationError} when the delivery is not genuine.
   */
  async verifySignature<TData = Record<string, unknown>>(
    rawBody: WebhookBody,
    signatureHeader: string,
    timestamp?: string | number
  ): Promise<WebhookPayload<TData>> {
    if (typeof signatureHeader !== 'string' || signatureHeader.trim() === '') {
      throw new WebhookVerificationError(
        'signature_header_missing',
        'The X-Lettermint-Signature header is missing.'
      );
    }
    const parsed = parseSignatureHeader(signatureHeader);
    if (timestamp !== undefined && String(timestamp).trim() !== parsed.timestamp) {
      throw new WebhookVerificationError(
        'delivery_timestamp_mismatch',
        'The X-Lettermint-Delivery header does not match the signed timestamp.'
      );
    }
    const bytes = bodyBytes(rawBody);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(parsed.timestamp)) > this.#tolerance) {
      throw new WebhookVerificationError(
        'timestamp_out_of_tolerance',
        'The signed timestamp is outside the allowed tolerance.'
      );
    }

    const subtle = getSubtle();
    this.#key ??= Promise.resolve(
      subtle.importKey('raw', utf8(this.#secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
      ])
    );
    const prefix = utf8(`${parsed.timestamp}.`);
    const signed = new Uint8Array(prefix.length + bytes.length);
    signed.set(prefix);
    signed.set(bytes, prefix.length);
    const expected = new Uint8Array(await subtle.sign('HMAC', await this.#key, signed));
    let matched = false;
    for (const candidate of parsed.signatures) {
      if (constantTimeEqual(candidate, expected)) matched = true;
    }
    if (!matched) {
      throw new WebhookVerificationError(
        'signature_mismatch',
        'The webhook signature does not match.'
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new WebhookVerificationError(
        'payload_invalid',
        'The webhook payload is not valid JSON.'
      );
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new WebhookVerificationError(
        'payload_invalid',
        'The webhook payload is not a JSON object.'
      );
    }
    return payload as WebhookPayload<TData>;
  }

  /** Contains no secret. */
  toJSON(): { tolerance: number } {
    return { tolerance: this.#tolerance };
  }

  [inspectCustom](_depth: number, options: unknown, inspect: unknown): string {
    return renderInspect('Webhook', { tolerance: this.#tolerance }, options, inspect);
  }
}
