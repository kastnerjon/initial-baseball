import type {
  DailyAtBatResultRulesetVersion,
  DailyRulesetVersion,
} from '@initial-baseball/shared';
import {
  isDailyAtBatAttemptRulesetVersion,
} from './dailyAtBatAttemptJournal';
import type { LoadedSavedDailyGame } from './dailyLocalStorage';

export function getDailyAtBatContributionRulesetVersion(
  requestedRulesetVersion: DailyRulesetVersion,
  loaded: LoadedSavedDailyGame | null,
): DailyAtBatResultRulesetVersion | null {
  if (!isDailyAtBatAttemptRulesetVersion(requestedRulesetVersion)) return null;
  if (loaded !== null
    && loaded.savedGame.gameState.rulesetVersion !== requestedRulesetVersion) {
    return null;
  }
  return requestedRulesetVersion;
}
