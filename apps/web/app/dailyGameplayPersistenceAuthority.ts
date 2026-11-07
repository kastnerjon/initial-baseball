import type { DailyPublicPuzzle, DailyRulesetVersion } from '@initial-baseball/shared';
import { isArchiveDailyPuzzleId } from './dailyModeStorage';

export type DailyGameplayAccess =
  | 'checking'
  | 'owner'
  | 'follower'
  | 'compatibility'
  | 'blocked';

export function getDailyGameplayPersistenceSessionKey(
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>,
  rulesetVersion: DailyRulesetVersion,
): string {
  return JSON.stringify([
    puzzle.id,
    puzzle.puzzleDate,
    puzzle.puzzleNumber,
    rulesetVersion,
  ]);
}

export function canPersistDailyGameplay(access: DailyGameplayAccess): boolean {
  return access === 'owner' || access === 'compatibility';
}

export function isArchiveBetaDailyPuzzleId(puzzleId?: string): boolean {
  return puzzleId?.startsWith('archive-beta-v1-daily-') === true;
}

/**
 * Reserve the ENTIRE official edition ID family, including future schema versions.
 * No secondary Daily may acquire score eligibility merely by changing the
 * version suffix before signed, exact-ID admission has been reviewed.
 */
export function isSecondaryOfficialDailyEditionId(puzzleId?: string): boolean {
  return puzzleId?.startsWith('daily-ed-') === true;
}

export function isDailyResultCollectionEnabled(puzzleId?: string): boolean {
  return !isSecondaryOfficialDailyEditionId(puzzleId)
    && (!isArchiveDailyPuzzleId(puzzleId) || isArchiveBetaDailyPuzzleId(puzzleId));
}

export function canPersistCurrentDailyGameplay({
  renderAccess,
  currentAccess,
  renderSessionKey,
  currentSessionKey,
  renderReadySessionKey,
  currentReadySessionKey,
}: {
  renderAccess: DailyGameplayAccess;
  currentAccess: DailyGameplayAccess;
  renderSessionKey: string;
  currentSessionKey: string | null;
  renderReadySessionKey: string | null;
  currentReadySessionKey: string | null;
}): boolean {
  return canPersistDailyGameplay(renderAccess)
    && currentAccess === renderAccess
    && currentSessionKey === renderSessionKey
    && renderReadySessionKey === renderSessionKey
    && currentReadySessionKey === renderSessionKey;
}
