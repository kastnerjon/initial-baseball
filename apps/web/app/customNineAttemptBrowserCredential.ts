import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isOfficialDailyOccurrenceId, validateCustomNinePuzzleId, validateCustomLineupPuzzleId } from '@initial-baseball/daily';

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
  | { kind: 'valid'; browserKeyDigest: string; replacementSetCookie?: string };

/** Anonymous challenge-only bearer credential; deleting cookies defeats continuity. */
export function createCustomNineAttemptBrowserCredential(secret: string) {
  return createScopedCredential(secret, V1);
}

/** Opaque, separately signed v2 browser identity. No public route is enabled. */
export function createCustomLineupV2AttemptBrowserCredential(secret: string) {
  return createScopedCredential(secret, V2);
}

export function isOfficialDailyBrowserPuzzleId(id: string): boolean {
  const prefix = 'daily-ed-v1-';
  return id.startsWith(prefix) && isOfficialDailyOccurrenceId(id.slice(prefix.length));
}

export function createOfficialDailyAttemptBrowserCredential(
  secret: string, legacyVerificationSecrets: readonly string[] = [],
) {
  return createScopedCredential(secret, {
    prefix: 'ib-official-daily-attempt-v1-', domain: 'initial-baseball:official-daily:attempt-browser:v1',
    path: '/api/daily/editions/',
    validate(id) {
      if (!isOfficialDailyBrowserPuzzleId(id)) throw new Error('Invalid official Daily edition.');
    },
  }, legacyVerificationSecrets);
}

function createScopedCredential(
  secret: string, scope: Scope, legacyVerificationSecrets: readonly string[] = [],
) {
  const acceptedSecrets = [secret, ...legacyVerificationSecrets];
  if (acceptedSecrets.some(key => key.trim().length < 32)) {
    throw new Error('Custom attempt signing unavailable.');
  }

  function name(puzzleId: string): string {
    scope.validate(puzzleId);
    return scope.prefix + puzzleId;
  }
  function signature(puzzleId: string, nonce: string, key = secret): string {
    return createHmac('sha256', key)
      .update(scope.domain + ':cookie\n' + puzzleId + '\n' + nonce)
      .digest('base64url');
  }
  function digest(puzzleId: string, nonce: string): string {
    return createHash('sha256')
      .update(scope.domain + ':digest\n' + puzzleId + '\n' + nonce)
      .digest('hex');
  }

  function setCookie(puzzleId: string, nonce: string, requestUrl: string): string {
    const cookieName = name(puzzleId);
    const secure = new URL(requestUrl).protocol === 'https:';
    return cookieName + '=' + nonce + '.' + signature(puzzleId, nonce)
      + '; Path=' + scope.path + puzzleId
      + '; Max-Age=' + MAX_AGE + '; HttpOnly; SameSite=Strict'
      + (secure ? '; Secure' : '');
  }

  return {
    issue(puzzleId: string, requestUrl: string) {
      const nonce = randomBytes(32).toString('base64url');
      return {
        browserKeyDigest: digest(puzzleId, nonce),
        setCookie: setCookie(puzzleId, nonce, requestUrl),
      };
    },
    inspect(cookieHeader: string | null, puzzleId: string, requestUrl?: string): Inspection {
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
      const actual = Buffer.from(pair[2]!, 'base64url');
      let activeValid = false;
      const valid = acceptedSecrets.reduce((matched, key, i) => {
        const expected = Buffer.from(signature(puzzleId, nonce, key), 'base64url');
        const matches = actual.length === expected.length && timingSafeEqual(actual, expected);
        if (i === 0) activeValid = matches;
        return matches || matched;
      }, false);
      if (!valid) return { kind: 'invalid' };
      // Re-sign the existing random nonce under the current key without
      // changing the database-bound digest/attempt. Never issue a new identity.
      const replacementSetCookie = !activeValid && requestUrl !== undefined
        ? setCookie(puzzleId, nonce, requestUrl) : undefined;
      return {
        kind: 'valid', browserKeyDigest: digest(puzzleId, nonce),
        ...(replacementSetCookie === undefined ? {} : { replacementSetCookie }),
      };
    },
  };
}
