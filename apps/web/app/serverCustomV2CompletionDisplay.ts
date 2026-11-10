import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createServerSupabaseClient } from './serverSupabaseClient';
import {
  createSupabaseCustomV2CompletionDisplayRepository,
  type CustomV2DisplayChoice, type CustomV2DisplayWrite,
} from './supabaseCustomV2CompletionDisplayRepository';

type Environment = Record<string, string | undefined>;
type Dependencies = {
  getSecret: (environment: Environment) => string;
  record: (input: CustomV2DisplayWrite, environment: Environment) =>
    Promise<'created' | 'existing'>;
};

const DEFAULT: Dependencies = {
  getSecret: getDailyProgressionSecret,
  record: (input, env) =>
    createSupabaseCustomV2CompletionDisplayRepository(createServerSupabaseClient(env))
      .record(input),
};
export type CustomV2DisplayResult =
  | { kind: 'disabled' | 'not_found' | 'invalid_choice' | 'invalid_credential' }
  | { kind: 'saved'; status: 'created' | 'existing' };

function parseChoice(value: unknown): CustomV2DisplayChoice | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.mode === 'anonymous') {
    if (Object.keys(candidate).some(key => key !== 'mode')) return null;
    return { mode: 'anonymous', displayName: null };
  }
  if (candidate.mode !== 'named' || Object.keys(candidate).some(key =>
    key !== 'mode' && key !== 'displayName')) return null;
  const name = parseCompletionDisplayName(candidate.displayName);
  return name.ok ? { mode: 'named', displayName: name.displayName } : null;
}

/** Source-staged only. No route, UI, user profile, or public score admission.
 * The database separately locks and verifies the exact completed+admitted
 * first attempt, all N score rows, and sticky creator exclusion.
 */
export function createServerCustomV2CompletionDisplayService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Environment; dependencies?: Dependencies } = {}) {
  return {
    async record(puzzleId: unknown, cookieHeader: string | null, choice: unknown):
      Promise<CustomV2DisplayResult> {
      if (environment.CUSTOM_V2_COMPLETION_DISPLAY_ENABLED !== 'true') {
        return { kind: 'disabled' };
      }
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }
      const parsed = parseChoice(choice);
      if (parsed === null) return { kind: 'invalid_choice' };

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

      // Fail closed without leaking private RPC/creator/score state to a later
      // HTTP consumer. The database is independently authoritative.
      try {
        const status = await dependencies.record({
          challengeId: puzzleId, browserKeyDigest: browser.browserKeyDigest,
          choice: parsed,
        }, environment);
        if (status !== 'created' && status !== 'existing') throw new Error('Invalid result.');
        return { kind: 'saved', status };
      } catch {
        throw new Error('Private Custom Lineup v2 completion display unavailable.');
      }
    },
  };
}
