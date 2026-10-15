import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validateCustomNinePuzzleId, validateCustomLineupPuzzleId } from '@initial-baseball/daily';

type Scope = Readonly<{ prefix: string; domain: string; path: string; validate: (id: string) => void }>;
const V1: Scope = {
  prefix: 'ib-custom-nine-attempt-v1-', domain: 'initial-baseball:custom-nine:attempt-browser:v1',
  path: '/api/custom-nine/challenges/', validate: validateCustomNinePuzzleId,
};
const V2: Scope = {
  prefix: 'ib-custom-lineup-v2-attempt-', domain: 'initial-baseball:custom-lineup:attempt-browser:v2',
  path: '/api/custom-lineup/challenges/', validate: validateCustomLineupPuzzleId,
};
const MAX_AGE = 365 * 24 * 60 * 60;
type Inspection =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'valid'; browserKeyDigest: string };

/** Anonymous challenge-only bearer credential; deleting cookies defeats continuity. */
export function createCustomNineAttemptBrowserCredential(secret: string) {
  return createScopedCredential(secret, V1);
}

/** Opaque, separately signed v2 browser identity. No public route is enabled. */
export function createCustomLineupV2AttemptBrowserCredential(secret: string) {
  return createScopedCredential(secret, V2);
}

function createScopedCredential(secret: string, scope: Scope) {
  if (secret.trim().length < 32) throw new Error('Custom attempt signing unavailable.');

  function name(puzzleId: string): string {
    scope.validate(puzzleId);
    return scope.prefix + puzzleId;
  }
  function signature(puzzleId: string, nonce: string): string {
    return createHmac('sha256', secret)
      .update(scope.domain + ':cookie\n' + puzzleId + '\n' + nonce)
      .digest('base64url');
  }
  function digest(puzzleId: string, nonce: string): string {
    return createHash('sha256')
      .update(scope.domain + ':digest\n' + puzzleId + '\n' + nonce)
      .digest('hex');
  }

  return {
    issue(puzzleId: string, requestUrl: string) {
      const cookieName = name(puzzleId);
      const nonce = randomBytes(32).toString('base64url');
      const token = nonce + '.' + signature(puzzleId, nonce);
      const secure = new URL(requestUrl).protocol === 'https:';
      return {
        browserKeyDigest: digest(puzzleId, nonce),
        setCookie: cookieName + '=' + token
          + '; Path=' + scope.path + puzzleId
          + '; Max-Age=' + MAX_AGE + '; HttpOnly; SameSite=Strict'
          + (secure ? '; Secure' : ''),
      };
    },
    inspect(cookieHeader: string | null, puzzleId: string): Inspection {
      const cookieName = name(puzzleId);
      const matches = (cookieHeader ?? '').split(';').map(x => x.trim())
        .filter(x => x.slice(0, x.indexOf('=') < 0 ? x.length : x.indexOf('=')) === cookieName);
      if (matches.length === 0) return { kind: 'absent' };
      if (matches.length !== 1) return { kind: 'invalid' };
      const observed = matches[0]!.slice(cookieName.length + 1);
      const pair = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(observed);
      if (pair === null) return { kind: 'invalid' };
      const nonce = pair[1]!;
      // Reject noncanonical base64url forms, including padded/ambiguous encodings.
      if (Buffer.from(nonce, 'base64url').toString('base64url') !== nonce
        || Buffer.from(nonce, 'base64url').length !== 32) return { kind: 'invalid' };
      if (Buffer.from(pair[2]!, 'base64url').toString('base64url') !== pair[2]) {
        return { kind: 'invalid' };
      }
      const expected = Buffer.from(signature(puzzleId, nonce), 'base64url');
      const actual = Buffer.from(pair[2]!, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return { kind: 'invalid' };
      }
      return { kind: 'valid', browserKeyDigest: digest(puzzleId, nonce) };
    },
  };
}
