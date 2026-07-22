import 'server-only';
import { createProductionCanonicalDailySelector } from '@initial-baseball/daily';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createDailyRuntimeService } from './dailyRuntimeService';
import { createPublicDailyPuzzleSource } from './publicDailyPuzzleSource';
import { getCanonicalRuntime, getCanonicalSearchCandidates, resolveCanonicalPlayerId } from './serverCanonicalData';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';

export const canonicalRuntime = getCanonicalRuntime();
export const canonicalSearchCandidates = getCanonicalSearchCandidates();

const selectCanonicalDailyPlayers = createProductionCanonicalDailySelector(
  DAILY_PUZZLE_OVERRIDES,
  resolveCanonicalPlayerId,
);
const publicDailyRepository = createOptionalPublicDailyRepository();

export const dailyRuntime = createDailyRuntimeService({
  canonicalRuntime,
  createPuzzle: createPublicDailyPuzzleSource({
    repository: publicDailyRepository,
    selectDeterministicPlayers: selectCanonicalDailyPlayers,
  }),
  progressionTokens: createDailyProgressionTokenCodec(getDailyProgressionSecret()),
});

function createOptionalPublicDailyRepository() {
  const hasUrl = Boolean(process.env.SUPABASE_URL?.trim());
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!hasUrl && !hasKey) return null;
  return createSupabaseDailyPuzzleRepository(createServerSupabaseClient());
}
