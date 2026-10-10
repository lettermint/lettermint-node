import { Emails } from './emails';
import { LettermintConfigError } from './errors';
import type { AnalyticsQuery, AnalyticsResponse, BlockedFileTypes } from './generated/types';
import { REDACTED, inspectCustom, renderInspect } from './redact';
import { Domains } from './resources/domains';
import { Messages } from './resources/messages';
import { Projects } from './resources/projects';
import { Routes } from './resources/routes';
import { Stats, Suppressions, Team } from './resources/team';
import { Webhooks } from './resources/webhooks';
import { checkToken, detectTokenKind } from './tokens';
import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
  type FetchFunction,
  type RequestOptions,
  Transport,
  checkBaseUrl,
  checkTimeout,
} from './transport';

/** Client options. Pass at least one token. */
export interface LettermintOptions {
  /** A project sending token (`lm_...`), sent as `x-lettermint-token`. Used by `emails.*`. */
  sendingToken?: string;
  /** A team API token (`lm_team_...`), sent as `Authorization: Bearer`. Used by the Team API. */
  teamToken?: string;
  /** API base URL. Default `https://api.lettermint.co/v1`. */
  baseUrl?: string;
  /** Request timeout in milliseconds, covering headers and body. Default 30000. */
  timeout?: number;
  /** A `fetch` implementation. Default: the global `fetch`. */
  fetch?: FetchFunction;
}

/** Options for the token shorthand `new Lettermint(token, options)`. */
export type LettermintShorthandOptions = Omit<LettermintOptions, 'sendingToken' | 'teamToken'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The Lettermint client.
 *
 * ```ts
 * const lettermint = new Lettermint({ sendingToken, teamToken });
 * const lettermint = new Lettermint('lm_...'); // team or sending token, detected by prefix
 * ```
 *
 * `emails.*` uses the sending token; every other part uses the team token.
 * The client holds no message state and is safe to share across requests.
 */
export class Lettermint {
  readonly #transport: Transport;

  /** Send email. Needs `sendingToken`. */
  public readonly emails: Emails;
  /** Sending domains. Needs `teamToken`. */
  public readonly domains: Domains;
  /** Sent and received messages. Needs `teamToken`. */
  public readonly messages: Messages;
  /** Projects and their report forwarding. Needs `teamToken`. */
  public readonly projects: Projects;
  /** Routes of a project. Needs `teamToken`. */
  public readonly routes: Routes;
  /** Sending statistics. Needs `teamToken`. */
  public readonly stats: Stats;
  /** The suppression list. Needs `teamToken`. */
  public readonly suppressions: Suppressions;
  /** The team and its members. Needs `teamToken`. */
  public readonly team: Team;
  /** Webhook endpoints and their deliveries. Needs `teamToken`. */
  public readonly webhooks: Webhooks;

  constructor(options: LettermintOptions);
  constructor(token: string, options?: LettermintShorthandOptions);
  constructor(
    tokenOrOptions: string | LettermintOptions,
    shorthandOptions?: LettermintShorthandOptions
  ) {
    let options: LettermintOptions;
    if (typeof tokenOrOptions === 'string') {
      if (shorthandOptions !== undefined && !isRecord(shorthandOptions)) {
        throw new LettermintConfigError('The options argument must be an object.');
      }
      const kind = detectTokenKind(tokenOrOptions);
      // Token options are ignored with the shorthand: the string decides.
      const {
        sendingToken: _sending,
        teamToken: _team,
        ...rest
      } = (shorthandOptions ?? {}) as LettermintOptions;
      options = { ...rest, [kind === 'team' ? 'teamToken' : 'sendingToken']: tokenOrOptions };
    } else if (isRecord(tokenOrOptions)) {
      options = tokenOrOptions;
    } else {
      throw new LettermintConfigError(
        'Pass an options object ({ sendingToken, teamToken }) or a token string.'
      );
    }

    if ('apiToken' in options) {
      throw new LettermintConfigError(
        '`apiToken` was removed in 3.0; pass `sendingToken` (project token) or `teamToken` (team API token).'
      );
    }
    const sendingToken = checkToken('sendingToken', options.sendingToken);
    const teamToken = checkToken('teamToken', options.teamToken);
    if (sendingToken === undefined && teamToken === undefined) {
      throw new LettermintConfigError('Pass `sendingToken`, `teamToken` or both.');
    }
    const fetchFunction =
      options.fetch ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
    if (typeof fetchFunction !== 'function') {
      throw new LettermintConfigError(
        'No global fetch is available; pass a fetch implementation as the `fetch` option.'
      );
    }

    this.#transport = new Transport({
      sendingToken,
      teamToken,
      baseUrl: checkBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL),
      timeout: options.timeout === undefined ? DEFAULT_TIMEOUT : checkTimeout(options.timeout),
      fetch: fetchFunction,
    });
    this.emails = new Emails(this.#transport);
    this.domains = new Domains(this.#transport);
    this.messages = new Messages(this.#transport);
    this.projects = new Projects(this.#transport);
    this.routes = new Routes(this.#transport);
    this.stats = new Stats(this.#transport);
    this.suppressions = new Suppressions(this.#transport);
    this.team = new Team(this.#transport);
    this.webhooks = new Webhooks(this.#transport);
  }

  /**
   * Checks the configured token: `GET /ping` returns `pong`. Uses the team token
   * when configured, otherwise the sending token.
   */
  async ping(options?: RequestOptions): Promise<string> {
    const text = await this.#transport.call('GET /ping', { label: 'ping', options });
    return text.trim();
  }

  /** Queries email analytics. Needs `teamToken`. */
  analytics(query: AnalyticsQuery, options?: RequestOptions): Promise<AnalyticsResponse> {
    return this.#transport.call('POST /analytics', { label: 'analytics', body: query, options });
  }

  /**
   * Queries email analytics and follows `pagination.next_cursor`, yielding one
   * whole response per request. Each response carries the next page of
   * `data.breakdown` with its own `meta` and `pagination`. Needs `teamToken`.
   *
   * A cursor expires 60 seconds after its response, so request the next page
   * promptly; an expired cursor rejects with a `ValidationError`. The query
   * passed in is not changed.
   */
  async *analyticsPages(
    query: AnalyticsQuery,
    options?: RequestOptions
  ): AsyncGenerator<AnalyticsResponse, void, undefined> {
    const seen = new Set<string>();
    if (typeof query.cursor === 'string') seen.add(query.cursor);
    let body = query;
    while (true) {
      const page = await this.analytics(body, options);
      yield page;
      const next = page.pagination?.next_cursor;
      if (typeof next !== 'string' || next === '' || seen.has(next)) return;
      seen.add(next);
      body = { ...query, cursor: next };
    }
  }

  /** The file extensions and MIME types that cannot be attached. Needs `teamToken`. */
  blockedFileTypes(options?: RequestOptions): Promise<BlockedFileTypes> {
    return this.#transport.call('GET /blocked-file-types', { label: 'blockedFileTypes', options });
  }

  #view(): Record<string, unknown> {
    return {
      baseUrl: this.#transport.baseUrl,
      timeout: this.#transport.timeout,
      sendingToken: this.#transport.hasSendingToken ? REDACTED : undefined,
      teamToken: this.#transport.hasTeamToken ? REDACTED : undefined,
    };
  }

  /** The configuration without credentials: tokens are shown as `[redacted]`. */
  toJSON(): Record<string, unknown> {
    return this.#view();
  }

  [inspectCustom](_depth: number, options: unknown, inspect: unknown): string {
    return renderInspect('Lettermint', this.#view(), options, inspect);
  }
}
