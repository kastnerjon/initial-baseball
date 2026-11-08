import 'server-only';
import { isOfficialDailyOccurrenceId } from '@initial-baseball/daily';
import type { CanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import type { DailyPuzzle } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDailyProgressionTokenCodec, type DailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import {
  createExactIdDailyRuntimeService,
  DailyRuntimeRequestError,
} from './dailyRuntimeService';
import { getCanonicalRuntime } from './serverCanonicalData';
import { readReleasedOfficialDailyPuzzle } from './serverReleasedOfficialDailyPuzzle';
import { createServerSupabaseClient } from './serverSupabaseClient';

const ID_PREFIX = 'daily-ed-v1-';
const UNAVAILABLE = 'Official Daily edition unavailable.';

type Dependencies = {
  environment?: Record<string, string | undefined>;
  now?: () => Date;
  createClient?: () => SupabaseClient;
  canonicalRuntime?: () => CanonicalRuntimeAccessor;
  progressionTokens?: () => DailyProgressionTokenCodec;
  readReleasedPuzzle?: (
    client: SupabaseClient, puzzleId: string, now: Date
  ) => Promise<DailyPuzzle | null>;
};

/**
 * Private edition runtime composition for the separately gated exact-ID
 * HTTP and server-rendered practice routes. Public activation remains OFF.
 *
 * The feature gate and canonical occurrence format are verified before any
 * service-role client or runtime is constructed. The existing release-aware
 * private reader owns Pacific-date eligibility; the exact-ID runtime verifies
 * signed progression before reading a puzzle for hints/guesses.
 *
 * This does not grant first-attempt or competitive score eligibility.
 */
export function createServerOfficialDailyEditionRuntime(
  puzzleId: string,
  dependencies: Dependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  if (environment.OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED !== 'true'
      || typeof puzzleId !== 'string' || !puzzleId.startsWith(ID_PREFIX)
      || !isOfficialDailyOccurrenceId(puzzleId.slice(ID_PREFIX.length))) {
    throw new DailyRuntimeRequestError(UNAVAILABLE);
  }

  const client = (dependencies.createClient ?? createServerSupabaseClient)();
  return createExactIdDailyRuntimeService({
    puzzleId,
    canonicalRuntime: (dependencies.canonicalRuntime ?? getCanonicalRuntime)(),
    progressionTokens: (dependencies.progressionTokens
      ?? (() => createDailyProgressionTokenCodec(getDailyProgressionSecret())))(),
    readEligiblePuzzle: id => (dependencies.readReleasedPuzzle
      ?? readReleasedOfficialDailyPuzzle)(client, id, (dependencies.now ?? (() => new Date()))()),
  });
}
