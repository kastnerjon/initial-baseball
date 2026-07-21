import type { DailyPuzzleEditorialRecord } from './dailyPuzzleLifecycle';
import { DAILY_LINEUP_QUALITY_LAUNCH_DATE } from './productionDailyLineup';

export type PublicDailyPuzzleSelectionDecision =
  | { kind: 'deterministic-fallback' }
  | { kind: 'editorial'; canonicalPlayerIds: readonly string[] }
  | { kind: 'archived-unavailable' };

export function resolvePublicDailyPuzzleSelection(
  puzzleDate: string,
  record: DailyPuzzleEditorialRecord | null,
): PublicDailyPuzzleSelectionDecision {
  if (puzzleDate < DAILY_LINEUP_QUALITY_LAUNCH_DATE) {
    return { kind: 'deterministic-fallback' };
  }
  if (record === null || record.puzzleDate !== puzzleDate || record.status === 'draft') {
    return { kind: 'deterministic-fallback' };
  }
  if (record.status === 'archived') {
    return { kind: 'archived-unavailable' };
  }
  return {
    kind: 'editorial',
    canonicalPlayerIds: [...record.selections]
      .sort((left, right) => left.slot - right.slot)
      .map(selection => selection.canonicalPlayerId),
  };
}
