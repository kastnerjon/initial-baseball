import 'server-only';
import { createCustomNineCreatorBrowserMarker } from './customNineCreatorBrowser';
import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';

export type CustomNineAttemptEligibility =
  | { kind: 'invalid' }
  | { kind: 'creator' }
  | { kind: 'absent' }
  | { kind: 'valid'; browserKeyDigest: string };

/**
 * Shared authorizer for staged attempt endpoints; never regard a missing
 * creator cookie as proof of noncreator human identity.
 */
export function inspectCustomNineAttemptEligibility(
  secret: string, cookieHeader: string | null, puzzleId: string,
): CustomNineAttemptEligibility {
  const creator = createCustomNineCreatorBrowserMarker(secret).inspect(cookieHeader, puzzleId);
  const attempt = createCustomNineAttemptBrowserCredential(secret).inspect(cookieHeader, puzzleId);
  if (creator === 'invalid' || attempt.kind === 'invalid') return { kind: 'invalid' };
  if (creator === 'creator') return { kind: 'creator' };
  return attempt;
}
