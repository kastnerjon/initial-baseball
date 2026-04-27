import { describe, expect, it } from 'vitest';
import { getGuessOutcome } from './getGuessOutcome.js';

describe('getGuessOutcome', () => {
  it.each([
    [0, 'HR', 'initials'],
    [1, '3B', 1],
    [2, '2B', 2],
    [3, '1B', 3],
    [4, 'BUNT', 4],
  ] as const)('maps a correct guess at reveal count %i to %s', (revealCount, outcome, source) => {
    expect(getGuessOutcome({
      isCorrect: true,
      revealCount,
      strikeCount: 0,
      maxStrikes: 3,
    })).toEqual({
      kind: 'correct',
      revealedCount: revealCount,
      outcome,
      source,
    });
  });

  it('increments strikes for an incorrect guess before the strikeout threshold', () => {
    expect(getGuessOutcome({
      isCorrect: false,
      revealCount: 2,
      strikeCount: 1,
      maxStrikes: 3,
    })).toEqual({
      kind: 'incorrect',
      revealedCount: 2,
      strikeCount: 2,
      remainingStrikes: 1,
    });
  });

  it('returns a strikeout once the max strikes threshold is reached', () => {
    expect(getGuessOutcome({
      isCorrect: false,
      revealCount: 3,
      strikeCount: 2,
      maxStrikes: 3,
    })).toEqual({
      kind: 'strikeout',
      revealedCount: 3,
      strikeCount: 3,
      outcome: 'K',
      source: 'strikeout',
    });
  });
});
