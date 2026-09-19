import type { DailyPublicPuzzle, DailyRulesetVersion } from '@initial-baseball/shared';

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
