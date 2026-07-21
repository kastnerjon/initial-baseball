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

export function createEditorialDailyPuzzleId(
  puzzleDate: string,
  canonicalPlayerIds: readonly string[],
): string {
  const selectionFingerprint = hashString(canonicalPlayerIds.join('\u001f')).toString(16).padStart(8, '0');
  return `daily-${puzzleDate}-editorial-${selectionFingerprint}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
