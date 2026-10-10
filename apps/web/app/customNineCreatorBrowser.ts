import { createHmac, timingSafeEqual } from 'node:crypto';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';

const COOKIE_PREFIX = 'ib-custom-nine-creator-v1-';
const SIGNING_DOMAIN = 'initial-baseball:custom-nine:creator-browser:v1';
const COOKIE_AGE_SECONDS = 10 * 365 * 24 * 60 * 60;
type Provenance = 'creator' | 'unmarked' | 'invalid';

/** Browser provenance, not account identity or a guarantee across devices. */
export function createCustomNineCreatorBrowserMarker(secret: string) {
  // Construct before immutable issuance to fail without inserting an unmarked row.
  if (secret.trim().length < 32) {
    throw new Error('Custom Nine creator signing configuration unavailable.');
  }

  function cookieName(puzzleId: string): string {
    validateCustomNinePuzzleId(puzzleId);
    return `${COOKIE_PREFIX}${puzzleId}`;
  }

  function signature(puzzleId: string): string {
    return createHmac('sha256', secret)
      .update(SIGNING_DOMAIN).update('\n').update(puzzleId).digest('base64url');
  }

  return {
    creatorCookie(puzzleId: string, requestUrl: string): string {
      const name = cookieName(puzzleId);
      const secure = new URL(requestUrl).protocol === 'https:';
      return `${name}=${signature(puzzleId)}; Path=/api/custom-nine/challenges/${puzzleId}; Max-Age=${COOKIE_AGE_SECONDS}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
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
      const expected = Buffer.from(signature(puzzleId), 'base64url');
      const actual = Buffer.from(observed, 'base64url');
      return actual.length === expected.length && timingSafeEqual(actual, expected)
        ? 'creator' : 'invalid';
    },
  };
}
