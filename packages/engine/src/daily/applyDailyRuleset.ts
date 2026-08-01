import {
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  type DailyInningState,
  type DailyOutcome,
  type DailyPointsSummary,
  type DailyRulesetVersion,
  type DailyScoreSummary,
} from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';

export const POINTS_V1_OUTCOME_POINTS: Readonly<Record<DailyOutcome, number>> = {
  HR: 5,
  '3B': 4,
  '2B': 3,
  '1B': 2,
  BB: 1,
  K: 0,
};

export const POINTS_V2_OUTCOME_POINTS: Readonly<Record<DailyOutcome, number>> = {
  HR: 4,
  '3B': 3,
  '2B': 2,
  '1B': 1,
  BB: 0.5,
  K: 0,
};

export type DailyRulesetEngineState = {
  inning: DailyInningState;
  score: DailyScoreSummary;
  points: DailyPointsSummary;
};

export type ApplyDailyOutcomeForRulesetInput = DailyRulesetEngineState & {
  rulesetVersion: DailyRulesetVersion;
  outcome: DailyOutcome;
  totalAtBats: number;
};

export function createDailyPointsSummary(
  rulesetVersion: DailyRulesetVersion,
  totalAtBats: number,
): DailyPointsSummary {
  return {
    points: 0,
    maximumPoints: getDailyMaximumPoints(rulesetVersion, totalAtBats),
    atBatsCompleted: 0,
    totalAtBats,
    completed: false,
  };
}

export function getDailyOutcomePoints(
  rulesetVersion: DailyRulesetVersion,
  outcome: DailyOutcome,
): number {
  return getOutcomePointsMapping(rulesetVersion)?.[outcome] ?? 0;
}

export function getDailyMaximumPoints(
  rulesetVersion: DailyRulesetVersion,
  totalAtBats: number,
): number {
  return totalAtBats * getDailyOutcomePoints(rulesetVersion, 'HR');
}

export function applyDailyOutcomeForRuleset(
  input: ApplyDailyOutcomeForRulesetInput,
): DailyRulesetEngineState {
  if (input.points.completed) {
    return {
      inning: input.inning,
      score: input.score,
      points: input.points,
    };
  }

  const baseballState = applyDailyOutcomeToInning({
    inning: input.inning,
    score: input.score,
    outcome: input.outcome,
  });
  const atBatsCompleted = Math.min(input.points.atBatsCompleted + 1, input.totalAtBats);

  if (input.rulesetVersion === LEGACY_DAILY_RULESET_VERSION) {
    const completed = baseballState.score.completed || atBatsCompleted >= input.totalAtBats;
    return {
      inning: baseballState.inning,
      score: {
        ...baseballState.score,
        completed,
      },
      points: {
        points: 0,
        maximumPoints: 0,
        atBatsCompleted,
        totalAtBats: input.totalAtBats,
        completed,
      },
    };
  }

  const completed = atBatsCompleted >= input.totalAtBats;
  return {
    inning: baseballState.inning,
    score: {
      ...baseballState.score,
      strikeouts: input.score.strikeouts + (input.outcome === 'K' ? 1 : 0),
      completed,
    },
    points: {
      points: input.points.points + getDailyOutcomePoints(input.rulesetVersion, input.outcome),
      maximumPoints: getDailyMaximumPoints(input.rulesetVersion, input.totalAtBats),
      atBatsCompleted,
      totalAtBats: input.totalAtBats,
      completed,
    },
  };
}

function getOutcomePointsMapping(
  rulesetVersion: DailyRulesetVersion,
): Readonly<Record<DailyOutcome, number>> | null {
  if (rulesetVersion === POINTS_V1_DAILY_RULESET_VERSION) {
    return POINTS_V1_OUTCOME_POINTS;
  }
  if (rulesetVersion === POINTS_V2_DAILY_RULESET_VERSION) {
    return POINTS_V2_OUTCOME_POINTS;
  }
  return null;
}
