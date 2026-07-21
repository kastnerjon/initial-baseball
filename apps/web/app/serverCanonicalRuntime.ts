import 'server-only';
import { createProductionCanonicalDailySelector } from '@initial-baseball/daily';
import { createCanonicalDailyPuzzleForDate } from './createDailyPuzzleForDate';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createDailyRuntimeService } from './dailyRuntimeService';
import { canonicalRuntime, resolveCanonicalPlayerId } from './serverCanonicalData';

export { canonicalRuntime, canonicalSearchCandidates } from './serverCanonicalData';

const selectCanonicalDailyPlayers = createProductionCanonicalDailySelector(
  DAILY_PUZZLE_OVERRIDES,
  resolveCanonicalPlayerId,
);

export const dailyRuntime = createDailyRuntimeService({
  canonicalRuntime,
  createPuzzle: date => createCanonicalDailyPuzzleForDate(date, selectCanonicalDailyPlayers),
  progressionTokens: createDailyProgressionTokenCodec(getDailyProgressionSecret()),
});
