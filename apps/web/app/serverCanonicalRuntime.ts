import 'server-only';
import type { DailyPuzzle } from '@initial-baseball/shared';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createCachedPublicDailyPuzzleSource } from './publicDailyPuzzleCache';
import { createDailyRuntimeService } from './dailyRuntimeService';
import {
  getCanonicalRevealReader,
  getCanonicalRuntime,
  resolveCanonicalPlayerId,
} from './serverCanonicalData';

type MaterializedPublicDailyPuzzleSource = (date: string) => Promise<DailyPuzzle>;

let materializedPublicDailyPuzzleSourcePromise: Promise<MaterializedPublicDailyPuzzleSource> | null = null;

const createPuzzle = createCachedPublicDailyPuzzleSource(materializePublicDailyPuzzle);

export const dailyRuntime = createDailyRuntimeService({
  resolveLegacyPlayerId: playerId => getCanonicalRuntime().requireCanonicalPlayerId(playerId),
  getCanonicalReveal: playerId => getCanonicalRevealReader().getReveal(playerId),
  createPuzzle,
  progressionTokens: createDailyProgressionTokenCodec(getDailyProgressionSecret()),
});

async function materializePublicDailyPuzzle(date: string): Promise<DailyPuzzle> {
  const source = await getMaterializedPublicDailyPuzzleSource();
  return source(date);
}

function getMaterializedPublicDailyPuzzleSource(): Promise<MaterializedPublicDailyPuzzleSource> {
  materializedPublicDailyPuzzleSourcePromise ??= buildMaterializedPublicDailyPuzzleSource();
  return materializedPublicDailyPuzzleSourcePromise;
}

async function buildMaterializedPublicDailyPuzzleSource(): Promise<MaterializedPublicDailyPuzzleSource> {
  const [daily, publicSource] = await Promise.all([
    import('@initial-baseball/daily'),
    import('./publicDailyPuzzleSource'),
  ]);
  const selectCanonicalDailyPlayers = daily.createProductionCanonicalDailySelector(
    DAILY_PUZZLE_OVERRIDES,
    resolveCanonicalPlayerId,
  );

  return publicSource.createPublicDailyPuzzleSource({
    repository: await createOptionalPublicDailyRepository(),
    selectDeterministicPlayers: selectCanonicalDailyPlayers,
  });
}

async function createOptionalPublicDailyRepository() {
  const hasUrl = Boolean(process.env.SUPABASE_URL?.trim());
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!hasUrl && !hasKey) return null;
  const [{ createServerSupabaseClient }, { createSupabaseDailyPuzzleRepository }] = await Promise.all([
    import('./serverSupabaseClient'),
    import('./supabaseDailyPuzzleRepository'),
  ]);
  return createSupabaseDailyPuzzleRepository(createServerSupabaseClient());
}
