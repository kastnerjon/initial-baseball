import {
  CLASSIC_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { getDailyAtBatContributionRulesetVersion } from './dailyAtBatContributionActivation';
import type { LoadedSavedDailyGame } from './dailyLocalStorage';

describe('Daily at-bat contribution activation', () => {
  it.each([
    POINTS_V3_DAILY_RULESET_VERSION,
    POINTS_V4_DAILY_RULESET_VERSION,
  ] as const)('allows a fresh exact-version %s run to contribute', (rulesetVersion) => {
    expect(getDailyAtBatContributionRulesetVersion(rulesetVersion, null))
      .toBe(rulesetVersion);
  });

  it.each([
    POINTS_V3_DAILY_RULESET_VERSION,
    POINTS_V4_DAILY_RULESET_VERSION,
  ] as const)('allows a restored native %s save only under the same requested ruleset', (rulesetVersion) => {
    expect(getDailyAtBatContributionRulesetVersion(
      rulesetVersion,
      loadedWithRuleset(rulesetVersion),
    )).toBe(rulesetVersion);
  });

  it('rejects cross-v3/v4 contribution identity', () => {
    expect(getDailyAtBatContributionRulesetVersion(
      POINTS_V4_DAILY_RULESET_VERSION,
      loadedWithRuleset(POINTS_V3_DAILY_RULESET_VERSION),
    )).toBeNull();
    expect(getDailyAtBatContributionRulesetVersion(
      POINTS_V3_DAILY_RULESET_VERSION,
      loadedWithRuleset(POINTS_V4_DAILY_RULESET_VERSION),
    )).toBeNull();
  });

  it.each([
    LEGACY_DAILY_RULESET_VERSION,
    POINTS_V1_DAILY_RULESET_VERSION,
    POINTS_V2_DAILY_RULESET_VERSION,
    CLASSIC_DAILY_RULESET_VERSION,
  ] as const)('keeps %s outside resolved-at-bat contribution', (rulesetVersion) => {
    expect(getDailyAtBatContributionRulesetVersion(rulesetVersion, null)).toBeNull();
    expect(getDailyAtBatContributionRulesetVersion(
      rulesetVersion,
      loadedWithRuleset(rulesetVersion),
    )).toBeNull();
  });
});

function loadedWithRuleset(rulesetVersion: DailyRulesetVersion): LoadedSavedDailyGame {
  return {
    savedGame: {
      gameState: { rulesetVersion },
    },
    completedAtBatFactsAreNative: true,
  } as LoadedSavedDailyGame;
}
