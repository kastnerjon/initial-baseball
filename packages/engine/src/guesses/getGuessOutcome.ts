import type { DailyGuessResult, DailyRevealCount } from '@initial-baseball/shared';

export type GetGuessOutcomeInput = {
  isCorrect: boolean;
  revealCount: DailyRevealCount;
  strikeCount: number;
  maxStrikes: number;
};

export function getGuessOutcome(input: GetGuessOutcomeInput): DailyGuessResult {
  if (input.isCorrect) {
    return {
      kind: 'correct',
      revealedCount: input.revealCount,
      outcome: getCorrectOutcome(input.revealCount),
      source: input.revealCount === 0 ? 'initials' : input.revealCount,
    };
  }

  const nextStrikeCount = input.strikeCount + 1;

  if (nextStrikeCount >= input.maxStrikes) {
    return {
      kind: 'strikeout',
      revealedCount: input.revealCount,
      strikeCount: nextStrikeCount,
      outcome: 'K',
      source: 'strikeout',
    };
  }

  return {
    kind: 'incorrect',
    revealedCount: input.revealCount,
    strikeCount: nextStrikeCount,
    remainingStrikes: input.maxStrikes - nextStrikeCount,
  };
}

function getCorrectOutcome(revealCount: DailyRevealCount): Exclude<DailyGuessResult, { kind: 'incorrect' | 'strikeout' }>['outcome'] {
  switch (revealCount) {
    case 0:
      return 'HR';
    case 1:
      return '3B';
    case 2:
      return '2B';
    case 3:
      return '1B';
    case 4:
      return 'BB';
  }
}
