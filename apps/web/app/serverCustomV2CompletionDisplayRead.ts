import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createServerSupabaseClient } from './serverSupabaseClient';
import {
  createSupabaseCustomV2CompletionDisplayReadRepository, type CustomV2StoredDisplay,
} from './supabaseCustomV2CompletionDisplayReadRepository';

type Environment = Record<string, string | undefined>;
type Dependencies = {
  getSecret: (env: Environment) => string;
  read: (id: string, digest: string, env: Environment) => Promise<CustomV2StoredDisplay | null>;
};
const DEFAULT: Dependencies = {
  getSecret: getDailyProgressionSecret,
  read: (id, digest, env) =>
    createSupabaseCustomV2CompletionDisplayReadRepository(createServerSupabaseClient(env))
      .read(id, digest),
};

export type CustomV2DisplayReadResult =
  | { kind: 'disabled' | 'not_found' | 'invalid_credential' }
  | { kind: 'not_set' }
  | { kind: 'found'; display: CustomV2StoredDisplay };

/** Internal readback only; no browser-facing GET route or public name lookup.
 * A valid challenge-scoped signed first-attempt cookie is necessary, but the
 * SQL RPC also proves that attempt's accepted score/creator status under lock.
 */
export function createServerCustomV2CompletionDisplayReadService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Environment; dependencies?: Dependencies } = {}) {
  return {
    async read(puzzleId: unknown, cookieHeader: string | null):
      Promise<CustomV2DisplayReadResult> {
      if (environment.CUSTOM_V2_COMPLETION_DISPLAY_ENABLED !== 'true') {
        return { kind: 'disabled' };
      }
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }

      // Do not expose secret configuration, digest or DB result on errors.
      let digest: string;
      try {
        const secret = dependencies.getSecret(environment);
        const creator = createCustomLineupV2CreatorBrowserMarker(secret).inspect(
          cookieHeader, puzzleId,
        );
        const browser = createCustomLineupV2AttemptBrowserCredential(secret).inspect(
          cookieHeader, puzzleId,
        );
        if (creator !== 'unmarked' || browser.kind !== 'valid') {
          return { kind: 'invalid_credential' };
        }
        digest = browser.browserKeyDigest;
      } catch {
        throw new Error('Private Custom Lineup v2 completion display unavailable.');
      }

      try {
        const stored = await dependencies.read(puzzleId, digest, environment);
        if (stored === null) return { kind: 'not_set' };
        if (stored.mode === 'anonymous' && stored.displayName === null) {
          return { kind: 'found', display: { mode: 'anonymous', displayName: null } };
        }
        if (stored.mode === 'named' && typeof stored.displayName === 'string') {
          return { kind: 'found', display: stored };
        }
        throw new Error('Invalid stored display.');
      } catch {
        throw new Error('Private Custom Lineup v2 completion display unavailable.');
      }
    },
  };
}
