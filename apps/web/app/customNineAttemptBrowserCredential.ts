import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';

const COOKIE_PREFIX = 'ib-custom-nine-attempt-v1-';
const DOMAIN = 'initial-baseball:custom-nine:attempt-browser:v1';
const MAX_AGE = 365 * 24 * 60 * 60;
type Inspection =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | { kind: 'valid'; browserKeyDigest: string };

/** Anonymous challenge-only bearer credential; deleting cookies defeats continuity. */
export function createCustomNineAttemptBrowserCredential(secret: string) {
  if (secret.trim().length < 32) throw new Error('Custom Nine attempt signing unavailable.');

  function name(puzzleId: string): string {
    validateCustomNinePuzzleId(puzzleId);
    return COOKIE_PREFIX + puzzleId;
  }
  function signature(puzzleId: string, nonce: string): string {
    return createHmac('sha256', secret)
      .update(DOMAIN + ':cookie\n' + puzzleId + '\n' + nonce)
      .digest('base64url');
  }
  function digest(puzzleId: string, nonce: string): string {
    return createHash('sha256')
      .update(DOMAIN + ':digest\n' + puzzleId + '\n' + nonce)
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
          + '; Path=/api/custom-nine/challenges/' + puzzleId
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
      const expected = Buffer.from(signature(puzzleId, nonce), 'base64url');
      const actual = Buffer.from(pair[2]!, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return { kind: 'invalid' };
      }
      return { kind: 'valid', browserKeyDigest: digest(puzzleId, nonce) };
    },
  };
}
