import 'server-only';
import type { PermanentDailyIssuedPuzzle } from '@initial-baseball/daily';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
  type Player,
} from '@initial-baseball/shared';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';

export type PermanentDailyPlayerResolver = (
  canonicalPlayerId: string,
) => Player | null;

/**
 * Materializes the immutable answer snapshot into today's gameplay-ready puzzle
 * shape without changing permanent identity or batting order.
 *
 * The permanent snapshot freezes answer identity/order. Canonical player facts
 * remain sourced through the same gameplay player records used by public Daily.
 */
export function materializePermanentDailyIssuedPuzzle(
  issuedPuzzle: PermanentDailyIssuedPuzzle,
  resolvePlayer: PermanentDailyPlayerResolver = getCanonicalDailyPlayer,
): DailyPuzzle {
  const pitches = issuedPuzzle.canonicalPlayerIds.map((canonicalPlayerId, index) => {
    const player = resolvePlayer(canonicalPlayerId);
    if (player === null) {
      throw new Error(
        `Permanent Daily ${issuedPuzzle.puzzleId} references unavailable canonical player ${canonicalPlayerId}.`,
      );
    }

    const pitch = createDailyPuzzlePitch(index + 1, player);
    return {
      ...pitch,
      player: {
        ...pitch.player,
        playerId: canonicalPlayerId,
      },
    };
  });

  return {
    id: issuedPuzzle.puzzleId,
    puzzleNumber: issuedPuzzle.identity.dailyNumber,
    puzzleDate: issuedPuzzle.identity.puzzleDate,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches,
  };
}
