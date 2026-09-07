import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookVerificationError } from './utils/errors';

export interface WebhookOptions {
  /** Maximum timestamp difference in seconds. The default is 300. */
  tolerance?: number;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export class Webhook {
  private readonly tolerance: number;

  constructor(
    private readonly secret: string,
    options: WebhookOptions = {}
  ) {
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new WebhookVerificationError('The webhook secret is required.');
    }
    this.tolerance = options.tolerance ?? 300;
    if (!Number.isSafeInteger(this.tolerance) || this.tolerance < 0) {
      throw new WebhookVerificationError('The tolerance must be a non-negative integer.');
    }
  }

  /** Verify the raw request body before JSON decoding. */
  public verify(payload: string | Buffer, signature: string, timestamp?: number): unknown {
    if ((typeof payload !== 'string' && !Buffer.isBuffer(payload)) || payload.length === 0) {
      throw new WebhookVerificationError('The raw request body is required.');
    }
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new WebhookVerificationError('The signature header is required.');
    }

    let signedTimestamp: string | undefined;
    const hashes: Buffer[] = [];
    for (const part of signature.split(',')) {
      const entry = part.trim();
      const separator = entry.indexOf('=');
      if (separator === -1) continue;
      const key = entry.slice(0, separator);
      const value = entry.slice(separator + 1);
      if (key === 't') {
        if (signedTimestamp !== undefined || !/^\d+$/.test(value ?? '')) {
          throw new WebhookVerificationError('The signature timestamp is invalid.');
        }
        signedTimestamp = value;
      } else if (key === 'v1' && /^[a-fA-F0-9]{64}$/.test(value ?? '')) {
        hashes.push(Buffer.from(value, 'hex'));
      }
    }
    const seconds = Number(signedTimestamp);
    if (signedTimestamp === undefined || !Number.isSafeInteger(seconds) || hashes.length === 0) {
      throw new WebhookVerificationError('The signature header is invalid.');
    }
    if (timestamp !== undefined && (!Number.isSafeInteger(timestamp) || timestamp !== seconds)) {
      throw new WebhookVerificationError('The signature and delivery timestamps do not match.');
    }
    if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > this.tolerance) {
      throw new WebhookVerificationError('The signature timestamp is outside the allowed range.');
    }

    const expected = createHmac('sha256', this.secret)
      .update(`${signedTimestamp}.`)
      .update(payload)
      .digest();
    if (!hashes.some((hash) => timingSafeEqual(hash, expected))) {
      throw new WebhookVerificationError('The webhook signature does not match.');
    }
    try {
      return JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
    } catch {
      throw new WebhookVerificationError('The webhook payload is not valid JSON.');
    }
  }

  /** Verify Node.js request headers and the raw request body. Header names are case-insensitive. */
  public verifyHeaders(headers: WebhookHeaders, payload: string | Buffer): unknown {
    const readHeader = (name: string): string => {
      const matches = Object.entries(headers).filter(([key]) => key.toLowerCase() === name);
      if (matches.length !== 1 || typeof matches[0][1] !== 'string') {
        throw new WebhookVerificationError(`A single ${name} header is required.`);
      }
      return matches[0][1];
    };
    const signature = readHeader('x-lettermint-signature');
    const delivery = readHeader('x-lettermint-delivery');
    if (!/^\d+$/.test(delivery)) {
      throw new WebhookVerificationError('The delivery timestamp is invalid.');
    }
    return this.verify(payload, signature, Number(delivery));
  }
}
