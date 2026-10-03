import { LettermintConfigError } from './errors';

/** Team API tokens: `ApiToken::TEAM_PREFIX` in the Lettermint backend. */
const TEAM_TOKEN = /^lm_team_[0-9A-Za-z]+$/;
/** Project sending tokens (32 or 22 random characters): `ApiToken::PROJECT_PREFIX`. */
const SENDING_TOKEN = /^lm_[0-9A-Za-z]+$/;
/** Characters allowed in a token, so that it is a valid HTTP header value. */
const HEADER_SAFE = /^[\x21-\x7e]+$/;

export type TokenKind = 'sending' | 'team';

/**
 * Classifies a token passed as `new Lettermint(token)`. The team pattern is
 * checked first, because every team token also starts with `lm_`. Error
 * messages never contain the token.
 */
export function detectTokenKind(token: unknown): TokenKind {
  if (typeof token === 'string') {
    if (TEAM_TOKEN.test(token)) return 'team';
    if (SENDING_TOKEN.test(token)) return 'sending';
  }
  throw new LettermintConfigError(
    'Unrecognised token format; pass { sendingToken } or { teamToken } instead.'
  );
}

/** Validates an explicitly configured token. Returns `undefined` when it is not set. */
export function checkToken(
  option: 'sendingToken' | 'teamToken',
  token: unknown
): string | undefined {
  if (token === undefined) return undefined;
  if (typeof token !== 'string' || token.length === 0) {
    throw new LettermintConfigError(`\`${option}\` must be a non-empty string.`);
  }
  if (!HEADER_SAFE.test(token)) {
    throw new LettermintConfigError(
      `\`${option}\` contains whitespace or characters that are not allowed in an HTTP header.`
    );
  }
  return token;
}
