import { createDailyShareResult } from '@initial-baseball/engine';
import { CLASSIC_DAILY_RULESET_VERSION, type DailyGameState } from '@initial-baseball/shared';
import { createDailyShareUrl } from './dailyShareUrl';

/** Preserve shared Daily/Classic completion rules while permitting exact-ID share paths. */
export function createCompletedDailyShareResult(gameState: DailyGameState, complete: boolean, sharePath?: string) {
  if (!complete) return null;
  const url = sharePath
    ? `${createDailyShareUrl().replace(/\/$/, '')}${sharePath}`
    : createDailyShareUrl(gameState.rulesetVersion === CLASSIC_DAILY_RULESET_VERSION ? '/classic' : '/');
  return createDailyShareResult({
    gameState: {
      ...gameState, status: 'completed',
      score: { ...gameState.score, completed: true },
      points: { ...gameState.points, completed: true },
    },
    url,
  });
}
