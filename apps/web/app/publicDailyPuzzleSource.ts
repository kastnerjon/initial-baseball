import 'server-only';
import {
  createEditorialDailyPuzzleId,
  resolvePublicDailyPuzzleSelection,
  type DailyPuzzleRepository,
  type ProductionCanonicalDailySelector,
} from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { createCanonicalDailyPuzzleForDate } from './createDailyPuzzleForDate';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';

export function createPublicDailyPuzzleSource(input: {
  repository: Pick<DailyPuzzleRepository, 'getByDate'> | null;
  selectDeterministicPlayers: ProductionCanonicalDailySelector;
}): (date: string) => Promise<DailyPuzzle> {
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
      id: createEditorialDailyPuzzleId(date, decision.canonicalPlayerIds),
      puzzleNumber: record?.puzzleNumber ?? 0,
      puzzleDate: date,
      status: record?.status ?? 'published',
      hintConfig: DEFAULT_DAILY_HINT_CONFIG,
      statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
      pitches: decision.canonicalPlayerIds.map((canonicalPlayerId, index) => {
        const player = getCanonicalDailyPlayer(canonicalPlayerId);
        if (player === null) {
          throw new Error(`Editorial Daily puzzle ${date} references unavailable canonical player ${canonicalPlayerId}.`);
        }
        const pitch = createDailyPuzzlePitch(index + 1, player);
        return { ...pitch, player: { ...pitch.player, playerId: canonicalPlayerId } };
      }),
    };
  };
}
