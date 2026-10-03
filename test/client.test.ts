import { inspect } from 'node:util';
import Default, { Lettermint, LettermintConfigError, LettermintError } from '../src';
import {
  BASE,
  SENDING_TOKEN,
  TEAM_TOKEN,
  client,
  fakeFetch,
  json,
  rejection,
  text,
  thrown,
} from './helpers';

const TEAM = `lm_team_${'A1b2C3d4E5'.repeat(4)}`;
const PROJECT_32 = `lm_${'Z9y8X7w6V5u4T3s2'.repeat(2)}`;
const PROJECT_22 = `lm_${'Q1w2E3r4T5y6U7i8O9p0A1'}`;

describe('construction', () => {
  it('exports the client as default and named export', () => {
    expect(Default).toBe(Lettermint);
  });

  it('requires at least one token', () => {
    const error = thrown(() => new Lettermint({}));
    expect(error).toBeInstanceOf(LettermintConfigError);
    expect(error).toBeInstanceOf(LettermintError);
    expect(error.name).toBe('LettermintConfigError');
    expect(error.message).toBe('Pass `sendingToken`, `teamToken` or both.');
  });

  it.each([
    [{ sendingToken: '' }, '`sendingToken` must be a non-empty string.'],
    [{ teamToken: 42 }, '`teamToken` must be a non-empty string.'],
    [{ sendingToken: `${SENDING_TOKEN}\n` }, '`sendingToken` contains whitespace'],
    [{ teamToken: `Bearer ${TEAM_TOKEN}` }, '`teamToken` contains whitespace'],
  ])('rejects invalid tokens %#', (options, message) => {
    const error = thrown(() => new Lettermint(options as never));
    expect(error).toBeInstanceOf(LettermintConfigError);
    expect(error.message).toContain(message);
    expect(error.message).not.toContain(SENDING_TOKEN);
    expect(error.message).not.toContain(TEAM_TOKEN);
  });

  it('explains the removed v2 apiToken option', () => {
    const error = thrown(() => new Lettermint({ apiToken: SENDING_TOKEN } as never));
    expect(error).toBeInstanceOf(LettermintConfigError);
    expect(error.message).toContain('`apiToken` was removed in 3.0');
    expect(error.message).not.toContain(SENDING_TOKEN);
  });

  it.each([
    ['not a url', 'absolute http(s) URL'],
    ['ftp://api.example.test', 'absolute http(s) URL'],
    ['https://user:pass@api.example.test/v1', 'must not contain credentials'],
    ['https://api.example.test/v1?x=1', 'must not contain credentials'],
  ])('rejects the base URL %s', (baseUrl, message) => {
    expect(() => new Lettermint({ sendingToken: SENDING_TOKEN, baseUrl })).toThrow(message);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '100'])(
    'rejects the timeout %p',
    (timeout) => {
      expect(
        () => new Lettermint({ sendingToken: SENDING_TOKEN, timeout: timeout as number })
      ).toThrow(LettermintConfigError);
    }
  );

  it('uses a custom base URL and strips trailing slashes', async () => {
    const { lettermint, requests } = client(
      { baseUrl: 'https://custom.example.test/api/v1///' },
      () => text(200, 'pong')
    );
    await lettermint.ping();
    expect(requests[0].url).toBe('https://custom.example.test/api/v1/ping');
  });

  it('uses the global fetch when none is passed', async () => {
    const original = globalThis.fetch;
    const { fetch } = fakeFetch(() => text(200, 'pong'));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    try {
      await expect(new Lettermint({ teamToken: TEAM_TOKEN }).ping()).resolves.toBe('pong');
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('fails clearly without any fetch', () => {
    const original = globalThis.fetch;
    // @ts-expect-error simulate a runtime without fetch
    globalThis.fetch = undefined;
    try {
      expect(() => new Lettermint({ teamToken: TEAM_TOKEN })).toThrow(
        'No global fetch is available'
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('token shorthand', () => {
  async function authHeaders(token: string) {
    const { fetch, requests } = fakeFetch(() => text(200, 'pong'));
    const lettermint = new Lettermint(token, { fetch });
    await lettermint.ping();
    return requests[0].headers;
  }

  it('detects a team token first', async () => {
    const headers = await authHeaders(TEAM);
    expect(headers.Authorization).toBe(`Bearer ${TEAM}`);
    expect(headers).not.toHaveProperty('x-lettermint-token');
  });

  it.each([
    ['32-character', PROJECT_32],
    ['22-character', PROJECT_22],
  ])('detects a %s project sending token', async (_, token) => {
    const headers = await authHeaders(token);
    expect(headers['x-lettermint-token']).toBe(token);
    expect(headers).not.toHaveProperty('Authorization');
  });

  it.each([
    ['an SSO token', `lm_sso_${'a1B2c3D4'.repeat(4)}`],
    ['an empty string', ''],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'],
    ['an unknown prefix', 'sk_live_0123456789abcdef'],
    ['a bare team prefix', 'lm_team_'],
    ['a bare project prefix', 'lm_'],
    ['a token with a trailing newline', `${PROJECT_32}\n`],
    ['a token with a dash', 'lm_abc-def'],
  ])('rejects %s without echoing it', (_, token) => {
    const error = thrown(() => new Lettermint(token));
    expect(error).toBeInstanceOf(LettermintConfigError);
    expect(error.message).toBe(
      'Unrecognised token format; pass { sendingToken } or { teamToken } instead.'
    );
    if (token) {
      expect(error.message).not.toContain(token);
      expect(String(error.stack)).not.toContain(token);
    }
  });

  it('ignores token options passed with the shorthand', async () => {
    const { fetch, requests } = fakeFetch(() => text(200, 'pong'));
    const lettermint = new Lettermint(PROJECT_32, { fetch, teamToken: TEAM } as never);
    await lettermint.ping();
    expect(requests[0].headers['x-lettermint-token']).toBe(PROJECT_32);
    expect(requests[0].headers).not.toHaveProperty('Authorization');
  });
});

describe('single-token clients', () => {
  it('rejects Team API calls without a team token, naming the option', async () => {
    const { fetch } = fakeFetch();
    const lettermint = new Lettermint({ sendingToken: SENDING_TOKEN, fetch });
    for (const call of [
      () => lettermint.domains.list(),
      () => lettermint.projects.reportForwarding.retrieve('project_1'),
      () => lettermint.team.members.list(),
      () => lettermint.webhooks.deliveries.list('webhook_1'),
      () => lettermint.analytics({ metrics: ['accepted'] }),
      () => lettermint.blockedFileTypes(),
      () => lettermint.messages.process('message_1'),
    ]) {
      const error = await rejection(call());
      expect(error).toBeInstanceOf(LettermintConfigError);
      expect(error.message).toMatch(/^[\w.]+ needs `teamToken`/);
      expect(error.message).not.toContain(SENDING_TOKEN);
    }
    const iterator = lettermint.domains.iterate();
    await expect(iterator.next()).rejects.toThrow('domains.iterate needs `teamToken`');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects sending without a sending token and never falls back to the team token', async () => {
    const { fetch } = fakeFetch();
    const lettermint = new Lettermint({ teamToken: TEAM_TOKEN, fetch });
    const message = { from: 'a@example.test', to: ['b@example.test'], subject: 'Hi' };
    await expect(lettermint.emails.send(message)).rejects.toThrow(
      'emails.send needs `sendingToken`'
    );
    await expect(lettermint.emails.sendBatch([message])).rejects.toThrow(
      'emails.sendBatch needs `sendingToken`'
    );
    await expect(lettermint.emails.ping()).rejects.toThrow('emails.ping needs `sendingToken`');
    expect(() => lettermint.emails.compose()).toThrow('emails.compose needs `sendingToken`');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pings with the team token when present, otherwise the sending token', async () => {
    const both = client({}, () => text(200, 'pong\n'));
    await expect(both.lettermint.ping()).resolves.toBe('pong');
    expect(both.requests[0].headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
    expect(both.requests[0].headers).not.toHaveProperty('x-lettermint-token');

    const sendingOnly = client({ teamToken: undefined }, () => text(200, 'pong'));
    await sendingOnly.lettermint.ping();
    expect(sendingOnly.requests[0].headers['x-lettermint-token']).toBe(SENDING_TOKEN);
    expect(sendingOnly.requests[0].headers).not.toHaveProperty('Authorization');

    await both.lettermint.emails.ping();
    expect(both.requests[1].headers['x-lettermint-token']).toBe(SENDING_TOKEN);
    expect(both.requests[1].headers).not.toHaveProperty('Authorization');
  });

  it('lets reschedule and cancel use the sending token when no team token is set', async () => {
    const scheduled = { message_id: 'm', status: 'scheduled', scheduled_at: null };
    const sendingOnly = client({ teamToken: undefined }, () => json(200, scheduled));
    await sendingOnly.lettermint.messages.cancel('m');
    await sendingOnly.lettermint.messages.reschedule('m', { scheduled_at: '2026-10-05T09:00:00Z' });
    for (const request of sendingOnly.requests) {
      expect(request.headers['x-lettermint-token']).toBe(SENDING_TOKEN);
      expect(request.headers).not.toHaveProperty('Authorization');
    }
    const both = client({}, () => json(200, scheduled));
    await both.lettermint.messages.cancel('m');
    expect(both.requests[0].headers.Authorization).toBe(`Bearer ${TEAM_TOKEN}`);
  });
});

describe('redaction', () => {
  const render = (value: unknown) => [
    inspect(value),
    inspect(value, { depth: Number.POSITIVE_INFINITY, showHidden: true }),
    JSON.stringify(value),
    String(value),
  ];

  it('never shows tokens on the client or any sub-client', () => {
    const { lettermint } = client();
    const subjects: unknown[] = [
      lettermint,
      lettermint.emails,
      lettermint.domains,
      lettermint.messages,
      lettermint.projects,
      lettermint.projects.reportForwarding,
      lettermint.routes,
      lettermint.stats,
      lettermint.suppressions,
      lettermint.team,
      lettermint.team.members,
      lettermint.webhooks,
      lettermint.webhooks.deliveries,
      lettermint.emails.compose().from('a@example.test').to('b@example.test').subject('Hi'),
    ];
    for (const subject of subjects) {
      for (const output of render(subject)) {
        expect(output).not.toContain(SENDING_TOKEN);
        expect(output).not.toContain(TEAM_TOKEN);
      }
    }
  });

  it('shows which tokens are configured', () => {
    const { lettermint } = client({ teamToken: undefined });
    expect(inspect(lettermint)).toContain("sendingToken: '[redacted]'");
    expect(lettermint.toJSON()).toEqual({
      baseUrl: BASE,
      timeout: 30000,
      sendingToken: '[redacted]',
      teamToken: undefined,
    });
    expect(Object.keys(lettermint)).not.toContain('sendingToken');
  });
});
