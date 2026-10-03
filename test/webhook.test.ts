import { createHmac } from 'node:crypto';
import { inspect } from 'node:util';
import {
  LettermintConfigError,
  LettermintError,
  Webhook,
  type WebhookPayload,
  WebhookVerificationError,
} from '../src';
import vectors from './fixtures/webhooks.json';

const now = 1700000000;
const secret = 'whsec_test-webhook-secret';
const body =
  '{"id":"d1","event":"message.delivered","timestamp":"2023-11-14T22:13:20Z","data":{"subject":"Hello 🌍"}}';
const sign = (payload: string | Uint8Array = body, timestamp = now, key = secret) =>
  `t=${timestamp},v1=${createHmac('sha256', key).update(`${timestamp}.`).update(payload).digest('hex')}`;
const headers = (signature = sign(), delivery: string | number = now) => ({
  'X-Lettermint-Signature': signature,
  'X-Lettermint-Delivery': String(delivery),
});

async function failure(promise: Promise<unknown>): Promise<WebhookVerificationError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(WebhookVerificationError);
    return error as WebhookVerificationError;
  }
  throw new Error('Expected verification to fail');
}

describe('Webhook', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
  });
  afterEach(() => jest.restoreAllMocks());

  it('verifies headers and returns the typed payload', async () => {
    const payload: WebhookPayload<{ subject: string }> = await new Webhook(secret).verify(
      body,
      headers()
    );
    expect(payload).toEqual(JSON.parse(body));
    expect(payload.event).toBe('message.delivered');
    expect(payload.data.subject).toBe('Hello 🌍');
    expect(new WebhookVerificationError('signature_mismatch', 'x')).toBeInstanceOf(LettermintError);
  });

  it('accepts a Fetch Headers object (edge runtimes)', async () => {
    const request = new Request('https://example.test/hook', {
      method: 'POST',
      body,
      headers: headers(),
    });
    await expect(
      new Webhook(secret).verify(await request.text(), request.headers)
    ).resolves.toEqual(JSON.parse(body));
  });

  it('verifies the exact bytes from a Uint8Array or ArrayBuffer', async () => {
    const raw = new TextEncoder().encode(` ${body}\n`);
    const webhook = new Webhook(secret);
    await expect(webhook.verify(raw, headers(sign(raw)))).resolves.toEqual(JSON.parse(body));
    await expect(webhook.verify(raw.buffer, headers(sign(raw)))).resolves.toEqual(JSON.parse(body));
    expect((await failure(webhook.verify(body, headers(sign(raw))))).reason).toBe(
      'signature_mismatch'
    );
  });

  it.each([-300, 0, 300])('accepts timestamps within tolerance: %i', async (offset) => {
    const t = now + offset;
    await expect(
      new Webhook(secret).verify(body, headers(sign(body, t), t))
    ).resolves.toBeDefined();
  });

  it.each([-301, 301])('rejects timestamps outside tolerance: %i', async (offset) => {
    const t = now + offset;
    const error = await failure(new Webhook(secret).verify(body, headers(sign(body, t), t)));
    expect(error.reason).toBe('timestamp_out_of_tolerance');
  });

  it('uses a custom tolerance and keeps the check enabled at zero', async () => {
    await failure(
      new Webhook(secret, { tolerance: 60 }).verify(body, headers(sign(body, now - 61), now - 61))
    );
    const webhook = new Webhook(secret, { tolerance: 0 });
    expect(webhook.tolerance).toBe(0);
    await expect(webhook.verify(body, headers())).resolves.toBeDefined();
    await failure(webhook.verify(body, headers(sign(body, now - 1), now - 1)));
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid tolerance: %s',
    (tolerance) => {
      expect(() => new Webhook(secret, { tolerance })).toThrow(LettermintConfigError);
    }
  );

  it('rejects an empty secret', () => {
    expect(() => new Webhook('')).toThrow(LettermintConfigError);
    expect(() => new Webhook(undefined as never)).toThrow('signing secret');
  });

  it('rejects a changed payload or wrong secret', async () => {
    expect((await failure(new Webhook(secret).verify('{}', headers()))).reason).toBe(
      'signature_mismatch'
    );
    expect((await failure(new Webhook('wrong').verify(body, headers()))).reason).toBe(
      'signature_mismatch'
    );
  });

  it.each([
    ['', 'signature_header_missing'],
    ['v1=abc', 'signature_header_malformed'],
    [`t=${now}`, 'signature_header_malformed'],
    [`t=${now},v1=abc`, 'signature_header_malformed'],
    [`t=${now},v1=${'g'.repeat(64)}`, 'signature_header_malformed'],
    [`t=${now},v1=${'a'.repeat(63)}`, 'signature_header_malformed'],
    [`t=${now},v1=${'a'.repeat(65)}`, 'signature_header_malformed'],
    [`t=${now},${sign()}`, 'signature_header_malformed'],
    [sign().replace(`t=${now}`, 't=NaN'), 'signature_header_malformed'],
    [sign().replace(`t=${now}`, 't=1e9'), 'signature_header_malformed'],
    [sign().replace(`t=${now}`, 't=-1'), 'signature_header_malformed'],
    [sign().replace(`t=${now}`, 't=9007199254740992'), 'signature_header_malformed'],
    [sign().replace(`t=${now}`, `t=${now}=extra`), 'signature_header_malformed'],
    [`${sign()}=extra`, 'signature_header_malformed'],
    [`${sign()}é`, 'signature_header_malformed'],
  ])('rejects the signature header %j', async (signature, reason) => {
    const error = await failure(new Webhook(secret).verifySignature(body, signature));
    expect(error.reason).toBe(reason);
  });

  it('accepts any matching v1 signature and ignores unsupported versions', async () => {
    const signature = `v2=ignored, v1=${'0'.repeat(64)}, ${sign()}, v1=malformed`;
    await expect(new Webhook(secret).verifySignature(body, signature)).resolves.toEqual(
      JSON.parse(body)
    );
  });

  it('rejects empty, parsed and non-JSON bodies', async () => {
    const webhook = new Webhook(secret);
    expect((await failure(webhook.verifySignature('', sign('')))).reason).toBe('body_invalid');
    expect((await failure(webhook.verifySignature(JSON.parse(body), sign()))).reason).toBe(
      'body_invalid'
    );
    expect((await failure(webhook.verifySignature('invalid', sign('invalid')))).reason).toBe(
      'payload_invalid'
    );
    expect((await failure(webhook.verifySignature('[1]', sign('[1]')))).reason).toBe(
      'payload_invalid'
    );
    expect((await failure(webhook.verifySignature('invalid', sign()))).reason).toBe(
      'signature_mismatch'
    );
  });

  it('checks the optional delivery timestamp of verifySignature', async () => {
    const webhook = new Webhook(secret);
    await expect(webhook.verifySignature(body, sign(), now)).resolves.toBeDefined();
    await expect(webhook.verifySignature(body, sign(), String(now))).resolves.toBeDefined();
    for (const timestamp of [now + 1, Number.NaN, '']) {
      expect((await failure(webhook.verifySignature(body, sign(), timestamp))).reason).toBe(
        'delivery_timestamp_mismatch'
      );
    }
  });

  it('reads Node.js headers case-insensitively', async () => {
    await expect(
      new Webhook(secret).verify(new TextEncoder().encode(body), {
        'x-lettermint-signature': sign(),
        'X-LETTERMINT-DELIVERY': [String(now)],
        host: 'localhost',
      })
    ).resolves.toEqual(JSON.parse(body));
  });

  it.each([
    [{}, 'signature_header_missing'],
    [{ 'x-lettermint-signature': sign() }, 'delivery_header_missing'],
    [{ 'x-lettermint-delivery': String(now) }, 'signature_header_missing'],
    [
      { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': undefined },
      'delivery_header_missing',
    ],
    [
      { 'x-lettermint-signature': [sign(), sign()], 'x-lettermint-delivery': String(now) },
      'signature_header_malformed',
    ],
    [
      { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': '' },
      'delivery_timestamp_mismatch',
    ],
    [
      { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': `${now}junk` },
      'delivery_timestamp_mismatch',
    ],
    [
      { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': String(now + 1) },
      'delivery_timestamp_mismatch',
    ],
    [
      {
        'x-lettermint-signature': sign(),
        'X-Lettermint-Signature': sign(),
        'x-lettermint-delivery': String(now),
      },
      'signature_header_malformed',
    ],
  ])('rejects missing, ambiguous or invalid headers %#', async (input, reason) => {
    const error = await failure(new Webhook(secret).verify(body, input as Record<string, string>));
    expect(error.reason).toBe(reason);
    expect(error.name).toBe('WebhookVerificationError');
  });

  it('never shows the secret', async () => {
    const webhook = new Webhook(secret);
    const error = await failure(webhook.verify('{}', headers(`t=1,v1=${'0'.repeat(64)}`, 1)));
    for (const subject of [webhook, error]) {
      for (const output of [
        inspect(subject),
        inspect(subject, { depth: Number.POSITIVE_INFINITY, showHidden: true }),
        JSON.stringify(subject),
        String(subject),
        String((subject as Error).stack ?? ''),
      ]) {
        expect(output).not.toContain(secret);
      }
    }
    expect(JSON.stringify(webhook)).toBe('{"tolerance":300}');
  });
});

describe('conformance webhook vectors', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the full vector set', () => {
    expect(vectors.vectors.length).toBeGreaterThanOrEqual(25);
  });

  it.each(vectors.vectors.map((vector) => [vector.id, vector] as const))(
    '%s',
    async (_, vector) => {
      jest.spyOn(Date, 'now').mockReturnValue(vector.now * 1000);
      const bytes = Uint8Array.from(atob(vector.body_base64), (c) => c.charCodeAt(0));
      const webhook = new Webhook(vector.secret, { tolerance: vector.tolerance });
      const result = webhook.verify(bytes, vector.headers as unknown as Record<string, string>);
      if (vector.expect === 'valid') {
        await expect(result).resolves.toEqual(JSON.parse(new TextDecoder().decode(bytes)));
      } else {
        const error = await failure(result);
        expect(error.reason).toBe(vector.reason);
      }
    }
  );
});
