import type { DailyInningState, DailyOutcome, DailyScoreSummary } from '@initial-baseball/shared';
import { advanceRunners } from '../scoring/advanceRunners.js';
import { advanceRunnersOnBunt } from '../scoring/advanceRunnersOnBunt.js';

export type DailyInningEngineState = {
  inning: DailyInningState;
  score: DailyScoreSummary;
};

export type ApplyDailyOutcomeInput = DailyInningEngineState & {
  outcome: DailyOutcome;
};

export function applyDailyOutcomeToInning(input: ApplyDailyOutcomeInput): DailyInningEngineState {
  if (isInningComplete(input.inning)) {
    return {
      inning: input.inning,
      score: {
        ...input.score,
        outs: input.inning.outs,
        completed: true,
      },
    };
  }

  switch (input.outcome) {
    case 'HR':
      return applyAdvancementOutcome(input, 'home_run', 1, 0);
    case '3B':
      return applyAdvancementOutcome(input, 'triple', 1, 0);
    case '2B':
      return applyAdvancementOutcome(input, 'double', 1, 0);
    case '1B':
      return applyAdvancementOutcome(input, 'single', 1, 0);
    case 'BUNT':
      return applyBuntOutcome(input);
    case 'K':
      return applyStrikeoutOutcome(input);
  }
}

function applyAdvancementOutcome(
  input: ApplyDailyOutcomeInput,
  hitResult: Parameters<typeof advanceRunners>[1],
  hitsAdded: number,
  strikeoutsAdded: number,
): DailyInningEngineState {
  const advancement = advanceRunners(input.inning.bases, hitResult);
  return finalizeState(input, advancement.bases, advancement.runsScored, advancement.outsAdded, hitsAdded, strikeoutsAdded);
}

function applyBuntOutcome(input: ApplyDailyOutcomeInput): DailyInningEngineState {
  const advancement = advanceRunnersOnBunt(input.inning.bases);
  return finalizeState(input, advancement.bases, advancement.runsScored, advancement.outsAdded, 0, 0);
}

function applyStrikeoutOutcome(input: ApplyDailyOutcomeInput): DailyInningEngineState {
  return finalizeState(input, input.inning.bases, 0, 1, 0, 1);
}

function finalizeState(
  input: ApplyDailyOutcomeInput,
  bases: DailyInningState['bases'],
  runsAdded: number,
  outsAdded: number,
  hitsAdded: number,
  strikeoutsAdded: number,
): DailyInningEngineState {
  const outs = input.inning.outs + outsAdded;
  const completed = outs >= input.inning.maxOuts;
  const inning: DailyInningState = {
    ...input.inning,
    bases,
    outs,
  };

  return {
    inning,
    score: {
      ...input.score,
      runs: input.score.runs + runsAdded,
      hits: input.score.hits + hitsAdded,
      outs: inning.outs,
      strikeouts: input.score.strikeouts + strikeoutsAdded,
      completed,
    },
  };
}

function isInningComplete(inning: DailyInningState): boolean {
  return inning.outs >= inning.maxOuts;
}
