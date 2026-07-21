import 'server-only';
import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import {
  createCanonicalDailyLineupCandidates,
  rankPlayersByRecognizability,
  resolvePublicDailyPuzzleSelection,
  type DailyPuzzleRepository,
  type ProductionCanonicalDailySelector,
} from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { createCanonicalDailyPuzzleForDate } from './createDailyPuzzleForDate';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { resolveCanonicalPlayerId } from './serverCanonicalData';

export function createPublicDailyPuzzleSource(input: {
  repository: DailyPuzzleRepository | null;
  selectDeterministicPlayers: ProductionCanonicalDailySelector;
}): (date: string) => Promise<DailyPuzzle> {
  const candidatesById = new Map(
    createCanonicalDailyLineupCandidates(
      rankPlayersByRecognizability(dailyEligiblePlayers),
      resolveCanonicalPlayerId,
    ).map(candidate => [candidate.canonicalPlayerId, candidate.player]),
  );

  return async (date) => {
    const record = input.repository === null ? null : await input.repository.getByDate(date);
    const decision = resolvePublicDailyPuzzleSelection(date, record);
    if (decision.kind === 'deterministic-fallback') {
      return createCanonicalDailyPuzzleForDate(date, input.selectDeterministicPlayers);
    }
    if (decision.kind === 'archived-unavailable') {
      throw new Error(`Daily puzzle ${date} is archived and has no settled public replay policy.`);
    }
    return {
      id: `daily-${date}`,
      puzzleNumber: record?.puzzleNumber ?? 0,
      puzzleDate: date,
      status: record?.status ?? 'published',
      hintConfig: DEFAULT_DAILY_HINT_CONFIG,
      statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
      pitches: decision.canonicalPlayerIds.map((canonicalPlayerId, index) => {
        const player = candidatesById.get(canonicalPlayerId);
        if (player === undefined) {
          throw new Error(`Editorial Daily puzzle ${date} references unavailable canonical player ${canonicalPlayerId}.`);
        }
        const pitch = createDailyPuzzlePitch(index + 1, player);
        return { ...pitch, player: { ...pitch.player, playerId: canonicalPlayerId } };
      }),
    };
  };
}
