import { createHmac, timingSafeEqual } from 'node:crypto';
import { validateCustomNinePuzzleId, validateCustomLineupPuzzleId } from '@initial-baseball/daily';

type Scope = Readonly<{ prefix: string; domain: string; path: string; validate: (id: string) => void }>;
const V1: Scope = {
  prefix: 'ib-custom-nine-creator-v1-', domain: 'initial-baseball:custom-nine:creator-browser:v1',
  path: '/api/custom-nine/challenges/', validate: validateCustomNinePuzzleId,
};
const V2: Scope = {
  prefix: 'ib-custom-lineup-creator-v2-', domain: 'initial-baseball:custom-lineup:creator-browser:v2',
  path: '/api/custom-lineup/challenges/', validate: validateCustomLineupPuzzleId,
};
const COOKIE_AGE_SECONDS = 10 * 365 * 24 * 60 * 60;
type Provenance = 'creator' | 'unmarked' | 'invalid';

/** Browser provenance, not account identity or a guarantee across devices. */
export function createCustomNineCreatorBrowserMarker(secret: string) {
  return createScopedCreatorMarker(secret, V1);
}

/** Prospective v2 creator provenance, not an account/anti-abuse guarantee. */
export function createCustomLineupV2CreatorBrowserMarker(secret: string) {
  return createScopedCreatorMarker(secret, V2);
}

function createScopedCreatorMarker(secret: string, scope: Scope) {
  // Construct before immutable issuance to fail without inserting an unmarked row.
  if (secret.trim().length < 32) {
    throw new Error('Custom Nine creator signing configuration unavailable.');
  }

  function cookieName(puzzleId: string): string {
    scope.validate(puzzleId);
    return `${scope.prefix}${puzzleId}`;
  }

  function signature(puzzleId: string): string {
    return createHmac('sha256', secret)
      .update(scope.domain).update('\n').update(puzzleId).digest('base64url');
  }

  return {
    creatorCookie(puzzleId: string, requestUrl: string): string {
      const name = cookieName(puzzleId);
      const secure = new URL(requestUrl).protocol === 'https:';
      return `${name}=${signature(puzzleId)}; Path=${scope.path}${puzzleId}; Max-Age=${COOKIE_AGE_SECONDS}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
    },
    inspect(cookieHeader: string | null, puzzleId: string): Provenance {
      const name = cookieName(puzzleId);
      const matches = (cookieHeader ?? '').split(';').map(part => part.trim())
        .filter(part => {
          const separator = part.indexOf('=');
          return (separator === -1 ? part : part.slice(0, separator)) === name;
        });
      if (matches.length === 0) return 'unmarked';
      // A future admission gate must reject both 'creator' AND 'invalid'.
      const match = matches[0];
      if (matches.length !== 1 || match === undefined) return 'invalid';
      const observed = match.slice(name.length + 1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(observed)) return 'invalid';
      // Base64url's last character may have multiple spellings for the same
      // decoded HMAC bytes. Require the canonical encoding before equality.
      if (Buffer.from(observed, 'base64url').toString('base64url') !== observed) {
        return 'invalid';
      }
      const expected = Buffer.from(signature(puzzleId), 'base64url');
      const actual = Buffer.from(observed, 'base64url');
      return actual.length === expected.length && timingSafeEqual(actual, expected)
        ? 'creator' : 'invalid';
    },
  };
}
