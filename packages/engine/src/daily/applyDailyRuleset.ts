import {
  isDailyPointsRulesetVersion,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
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

export const POINTS_V4_MIN_POINTS_PER_AT_BAT = -1;
export const POINTS_V4_MAX_POINTS_PER_AT_BAT = 4;
export const POINTS_V4_SCORE_STEP = 1;

export const POINTS_V4_OUTCOME_POINTS: Readonly<Record<DailyOutcome, number>> = {
  HR: POINTS_V4_MAX_POINTS_PER_AT_BAT,
  '3B': 3,
  '2B': 2,
  '1B': 1,
  BB: 0,
  K: POINTS_V4_MIN_POINTS_PER_AT_BAT,
};

export const POINTS_V3_MAX_POINTS_PER_AT_BAT = 7;

export type DailyAtBatPointsInput = {
  rulesetVersion: DailyRulesetVersion;
  outcome: DailyOutcome;
  hintsRevealed?: number | undefined;
  wrongGuesses?: number | undefined;
};

export type DailyAtBatPointsRemainingInput = {
  rulesetVersion: DailyRulesetVersion;
  hintsRevealed?: number | undefined;
  wrongGuesses?: number | undefined;
  atBatComplete?: boolean | undefined;
};

export type DailyPointsRange = {
  minimumPoints: number;
  maximumPoints: number;
  step: number;
};

export type DailyRulesetEngineState = {
  inning: DailyInningState;
  score: DailyScoreSummary;
  points: DailyPointsSummary;
};

export type ApplyDailyOutcomeForRulesetInput = DailyRulesetEngineState & {
  rulesetVersion: DailyRulesetVersion;
  outcome: DailyOutcome;
  hintsRevealed?: number;
  wrongGuesses?: number;
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

export function getDailyAtBatPoints({
  rulesetVersion,
  outcome,
  hintsRevealed = 0,
  wrongGuesses = 0,
}: DailyAtBatPointsInput): number {
  if (rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION) {
    const normalizedWrongGuesses = clampNonNegative(wrongGuesses);
    if (outcome === 'K' || normalizedWrongGuesses >= 3) return 0;
    return Math.max(0, POINTS_V3_MAX_POINTS_PER_AT_BAT - clampNonNegative(hintsRevealed) - normalizedWrongGuesses);
  }
  if (rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION && clampNonNegative(wrongGuesses) >= 3) {
    return POINTS_V4_OUTCOME_POINTS.K;
  }
  return getDailyOutcomePoints(rulesetVersion, outcome);
}

/** Returns the live points still available for the active Daily Nine at-bat. */
export function getDailyAtBatPointsRemaining({
  rulesetVersion,
  hintsRevealed = 0,
  wrongGuesses = 0,
  atBatComplete = false,
}: DailyAtBatPointsRemainingInput): number | null {
  if (rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION) {
    if (atBatComplete) return 0;
    return getDailyAtBatPoints({
      rulesetVersion,
      outcome: 'HR',
      hintsRevealed,
      wrongGuesses,
    });
  }
  if (rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION) {
    if (atBatComplete) return 0;
    return getDailyAtBatPoints({
      rulesetVersion,
      outcome: getPointsV4LiveOutcome(hintsRevealed),
      hintsRevealed,
      wrongGuesses,
    });
  }
  return null;
}

export function getDailyMaximumPoints(
  rulesetVersion: DailyRulesetVersion,
  totalAtBats: number,
): number {
  return totalAtBats * getDailyOutcomePoints(rulesetVersion, 'HR');
}

export function getDailyPointsRange(
  rulesetVersion: DailyRulesetVersion,
  totalAtBats: number,
): DailyPointsRange | null {
  if (!isDailyPointsRulesetVersion(rulesetVersion)) return null;
  const outcomePoints = getOutcomePointsMapping(rulesetVersion);
  if (outcomePoints === null) return null;

  const values = Object.values(outcomePoints);
  return {
    minimumPoints: Math.min(...values) * totalAtBats,
    maximumPoints: Math.max(...values) * totalAtBats,
    step: rulesetVersion === POINTS_V2_DAILY_RULESET_VERSION
      ? 0.5
      : rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION
        ? POINTS_V4_SCORE_STEP
        : 1,
  };
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
  const pointsAwarded = getDailyAtBatPoints({
    rulesetVersion: input.rulesetVersion,
    outcome: input.outcome,
    hintsRevealed: input.hintsRevealed,
    wrongGuesses: input.wrongGuesses,
  });
  const atBatsCompleted = Math.min(input.points.atBatsCompleted + 1, input.totalAtBats);

  if (!isDailyPointsRulesetVersion(input.rulesetVersion)) {
    const completed = isDailyGameComplete(input.rulesetVersion, atBatsCompleted, input.totalAtBats, baseballState.score.outs, input.inning.maxOuts);
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

  const completed = isDailyGameComplete(input.rulesetVersion, atBatsCompleted, input.totalAtBats, baseballState.score.outs);
  return {
    inning: baseballState.inning,
    score: {
      ...baseballState.score,
      strikeouts: input.score.strikeouts + (input.outcome === 'K' ? 1 : 0),
      completed,
    },
    points: {
      points: input.points.points + pointsAwarded,
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
  if (rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION) {
    return {
      HR: POINTS_V3_MAX_POINTS_PER_AT_BAT,
      '3B': POINTS_V3_MAX_POINTS_PER_AT_BAT - 1,
      '2B': POINTS_V3_MAX_POINTS_PER_AT_BAT - 2,
      '1B': POINTS_V3_MAX_POINTS_PER_AT_BAT - 3,
      BB: POINTS_V3_MAX_POINTS_PER_AT_BAT - 4,
      K: 0,
    };
  }
  if (rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION) {
    return POINTS_V4_OUTCOME_POINTS;
  }
  return null;
}

function getPointsV4LiveOutcome(hintsRevealed: number): Exclude<DailyOutcome, 'K'> {
  const revealCount = Math.min(4, Math.floor(clampNonNegative(hintsRevealed)));
  switch (revealCount) {
    case 0:
      return 'HR';
    case 1:
      return '3B';
    case 2:
      return '2B';
    case 3:
      return '1B';
    default:
      return 'BB';
  }
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Shared by outcome application and signed server progression. */
export function isDailyGameComplete(
  rulesetVersion: DailyRulesetVersion,
  atBatsCompleted: number,
  totalAtBats: number,
  outs: number,
  maxOuts = 3,
): boolean {
  return atBatsCompleted >= totalAtBats
    || (!isDailyPointsRulesetVersion(rulesetVersion) && outs >= maxOuts);
}
