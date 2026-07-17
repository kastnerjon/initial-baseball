import { describe, expect, it } from 'vitest';
import type { DailyInningState, DailyScoreSummary } from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';

const inning = (outs: number): DailyInningState => ({
  inningNumber: 1,
  outs,
  maxOuts: 3,
  bases: { first: false, second: false, third: true },
  completedAtBats: [],
  currentAtBat: null,
});

const score = (): DailyScoreSummary => ({
  runs: 0,
  hits: 0,
  outs: 2,
  strikeouts: 0,
  completed: false,
});

describe('SAC scoring on the third out', () => {
  it('does not score a runner from third when the SAC creates the third out', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'SAC',
      inning: inning(2),
      score: score(),
    });

    expect(result.score).toMatchObject({
      runs: 0,
      outs: 3,
      completed: true,
    });
  });

  it('still scores a runner from third when fewer than two outs exist', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'SAC',
      inning: inning(1),
      score: { ...score(), outs: 1 },
    });

    expect(result.score).toMatchObject({
      runs: 1,
      outs: 2,
      completed: false,
    });
  });
});
