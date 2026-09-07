import { createHmac } from 'node:crypto';
import { LettermintError, Webhook, WebhookVerificationError } from './index';

const now = 1700000000;
const secret = 'test-webhook-secret';
const body = '{"event":"message.delivered","data":{"subject":"Hello 🌍"}}';
const sign = (payload: string | Buffer = body, timestamp = now, key = secret) =>
  `t=${timestamp},v1=${createHmac('sha256', key).update(`${timestamp}.`).update(payload).digest('hex')}`;

describe('Webhook', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
  });
  afterEach(() => jest.restoreAllMocks());

  it('exports the verifier and SDK error type', () => {
    expect(new WebhookVerificationError('test')).toBeInstanceOf(LettermintError);
    expect(new Webhook(secret).verify(body, sign())).toEqual(JSON.parse(body));
  });

  it('verifies exact UTF-8 bytes from a Buffer', () => {
    const raw = Buffer.from(` ${body}\n`);
    expect(new Webhook(secret).verify(raw, sign(raw))).toEqual(JSON.parse(body));
    expect(() => new Webhook(secret).verify(body, sign(raw))).toThrow(WebhookVerificationError);
  });

  it.each([-300, 0, 300])('accepts timestamps within tolerance: %i', (offset) => {
    expect(new Webhook(secret).verify(body, sign(body, now + offset))).toEqual(JSON.parse(body));
  });

  it.each([-301, 301])('rejects timestamps outside tolerance: %i', (offset) => {
    expect(() => new Webhook(secret).verify(body, sign(body, now + offset))).toThrow(
      'outside the allowed range'
    );
  });

  it('uses a custom tolerance and keeps the check enabled at zero', () => {
    expect(() => new Webhook(secret, { tolerance: 60 }).verify(body, sign(body, now - 61))).toThrow(
      WebhookVerificationError
    );
    const webhook = new Webhook(secret, { tolerance: 0 });
    expect(webhook.verify(body, sign())).toEqual(JSON.parse(body));
    expect(() => webhook.verify(body, sign(body, now - 1))).toThrow(WebhookVerificationError);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid tolerance: %s',
    (tolerance) => {
      expect(() => new Webhook(secret, { tolerance })).toThrow(WebhookVerificationError);
    }
  );

  it('rejects an empty secret', () => {
    expect(() => new Webhook('')).toThrow(WebhookVerificationError);
  });

  it('rejects a changed payload or wrong secret', () => {
    expect(() => new Webhook(secret).verify('{}', sign())).toThrow('does not match');
    expect(() => new Webhook('wrong').verify(body, sign())).toThrow('does not match');
  });

  it.each([
    '',
    'v1=abc',
    `t=${now}`,
    `t=${now},v1=abc`,
    `t=${now},v1=${'g'.repeat(64)}`,
    `t=${now},v1=${'a'.repeat(63)}`,
    `t=${now},v1=${'a'.repeat(65)}`,
    `t=${now},${sign()}`,
    sign().replace(`t=${now}`, 't=NaN'),
    sign().replace(`t=${now}`, 't=1e9'),
    sign().replace(`t=${now}`, 't=-1'),
    sign().replace(`t=${now}`, 't=9007199254740992'),
    sign().replace(`t=${now}`, `t=${now}=extra`),
    `${sign()}=extra`,
  ])('rejects invalid signature headers: %s', (signature) => {
    expect(() => new Webhook(secret).verify(body, signature)).toThrow(WebhookVerificationError);
  });

  it('accepts any matching v1 signature and ignores unsupported versions', () => {
    const signature = `v2=ignored, v1=${'0'.repeat(64)}, ${sign()}, v1=malformed`;
    expect(new Webhook(secret).verify(body, signature)).toEqual(JSON.parse(body));
  });

  it('rejects empty bodies and invalid signed JSON', () => {
    expect(() => new Webhook(secret).verify('', sign(''))).toThrow(WebhookVerificationError);
    expect(() => new Webhook(secret).verify('invalid', sign('invalid'))).toThrow('not valid JSON');
    expect(() => new Webhook(secret).verify('invalid', sign())).toThrow('does not match');
  });

  it('checks the optional delivery timestamp', () => {
    const webhook = new Webhook(secret);
    expect(webhook.verify(body, sign(), now)).toEqual(JSON.parse(body));
    for (const timestamp of [now + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => webhook.verify(body, sign(), timestamp)).toThrow('do not match');
    }
  });

  it('accepts Node.js headers with case-insensitive names', () => {
    expect(
      new Webhook(secret).verifyHeaders(
        {
          'X-Lettermint-Signature': sign(),
          'x-lettermint-delivery': String(now),
          host: 'localhost',
        },
        Buffer.from(body)
      )
    ).toEqual(JSON.parse(body));
  });

  it.each([
    {},
    { 'x-lettermint-signature': sign() },
    { 'x-lettermint-delivery': String(now) },
    { 'x-lettermint-signature': [sign()], 'x-lettermint-delivery': String(now) },
    { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': '' },
    { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': `${now}junk` },
    { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': String(now + 1) },
    { 'x-lettermint-signature': sign(), 'x-lettermint-delivery': '9007199254740992' },
    {
      'x-lettermint-signature': sign(),
      'X-Lettermint-Signature': sign(),
      'x-lettermint-delivery': String(now),
    },
  ])('rejects missing, ambiguous, or invalid headers: %j', (headers) => {
    expect(() => new Webhook(secret).verifyHeaders(headers, body)).toThrow(
      WebhookVerificationError
    );
  });
});
