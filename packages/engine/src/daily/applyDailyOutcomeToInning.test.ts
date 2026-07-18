import { describe, expect, it } from 'vitest';
import type { DailyInningState, DailyScoreSummary } from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';

const baseInning = (bases: DailyInningState['bases'], outs = 0): DailyInningState => ({
  inningNumber: 1,
  outs,
  maxOuts: 3,
  bases,
  completedAtBats: [],
  currentAtBat: null,
});

const baseScore = (overrides: Partial<DailyScoreSummary> = {}): DailyScoreSummary => ({
  runs: 0,
  hits: 0,
  outs: 0,
  strikeouts: 0,
  completed: false,
  ...overrides,
});

describe('applyDailyOutcomeToInning', () => {
  it.each([
    ['HR', { first: false, second: false, third: false }, { first: false, second: false, third: false }, 1, 1, 0, 0],
    ['3B', { first: false, second: false, third: false }, { first: false, second: false, third: true }, 0, 1, 0, 0],
    ['2B', { first: false, second: false, third: false }, { first: false, second: true, third: false }, 0, 1, 0, 0],
    ['1B', { first: false, second: false, third: false }, { first: true, second: false, third: false }, 0, 1, 0, 0],
    ['BB', { first: false, second: false, third: false }, { first: true, second: false, third: false }, 0, 0, 0, 0],
    ['K', { first: false, second: false, third: false }, { first: false, second: false, third: false }, 0, 0, 1, 1],
  ] as const)(
    'applies %s with empty bases',
    (outcome, startingBases, endingBases, runs, hits, outs, strikeouts) => {
      const result = applyDailyOutcomeToInning({
        outcome,
        inning: baseInning(startingBases),
        score: baseScore(),
      });

      expect(result.inning.bases).toEqual(endingBases);
      expect(result.score).toMatchObject({
        runs,
        hits,
        outs,
        strikeouts,
        completed: false,
      });
    },
  );

  it('scores batter and all runners on a home run', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'HR',
      inning: baseInning({ first: true, second: false, third: true }),
      score: baseScore(),
    });

    expect(result.inning.bases).toEqual({ first: false, second: false, third: false });
    expect(result.score).toMatchObject({ runs: 3, hits: 1, outs: 0, strikeouts: 0 });
  });

  it('puts the batter on third and scores all runners on a triple', () => {
    const result = applyDailyOutcomeToInning({
      outcome: '3B',
      inning: baseInning({ first: true, second: true, third: false }),
      score: baseScore(),
    });

    expect(result.inning.bases).toEqual({ first: false, second: false, third: true });
    expect(result.score).toMatchObject({ runs: 2, hits: 1, outs: 0, strikeouts: 0 });
  });

  it('moves the batter to second and advances runners on a double', () => {
    const result = applyDailyOutcomeToInning({
      outcome: '2B',
      inning: baseInning({ first: true, second: true, third: true }),
      score: baseScore(),
    });

    expect(result.inning.bases).toEqual({ first: false, second: true, third: true });
    expect(result.score).toMatchObject({ runs: 2, hits: 1, outs: 0, strikeouts: 0 });
  });

  it('moves the batter to first and advances runners on a single', () => {
    const result = applyDailyOutcomeToInning({
      outcome: '1B',
      inning: baseInning({ first: true, second: true, third: true }),
      score: baseScore(),
    });

    expect(result.inning.bases).toEqual({ first: true, second: true, third: true });
    expect(result.score).toMatchObject({ runs: 1, hits: 1, outs: 0, strikeouts: 0 });
  });

  it('adds an out and a strikeout for K with no runner movement', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'K',
      inning: baseInning({ first: true, second: false, third: true }),
      score: baseScore(),
    });

    expect(result.inning.bases).toEqual({ first: true, second: false, third: true });
    expect(result.score).toMatchObject({ runs: 0, hits: 0, outs: 1, strikeouts: 1 });
  });

  it('marks the inning completed when outs reach maxOuts', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'K',
      inning: baseInning({ first: false, second: false, third: false }, 2),
      score: baseScore({ outs: 2 }),
    });

    expect(result.inning.outs).toBe(3);
    expect(result.score).toMatchObject({ outs: 3, strikeouts: 1, completed: true });
  });

  it('derives returned score outs from inning outs when input score outs is stale', () => {
    const result = applyDailyOutcomeToInning({
      outcome: '1B',
      inning: baseInning({ first: false, second: false, third: false }, 1),
      score: baseScore({ outs: 99 }),
    });

    expect(result.inning.outs).toBe(1);
    expect(result.score.outs).toBe(result.inning.outs);
  });

  it('keeps inning outs and score outs aligned after a strikeout from two outs', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'K',
      inning: baseInning({ first: false, second: false, third: false }, 2),
      score: baseScore({ outs: 0 }),
    });

    expect(result.inning.outs).toBe(3);
    expect(result.score.outs).toBe(3);
  });

  it('does not add an out for a walk with two outs', () => {
    const result = applyDailyOutcomeToInning({
      outcome: 'BB',
      inning: baseInning({ first: true, second: false, third: false }, 2),
      score: baseScore({ outs: 2 }),
    });

    expect(result.inning.outs).toBe(2);
    expect(result.score.outs).toBe(2);
    expect(result.score.completed).toBe(false);
  });

  it('treats outcomes after inning completion as a no-op', () => {
    const inning = baseInning({ first: true, second: true, third: false }, 3);
    const score = baseScore({ runs: 2, hits: 2, outs: 1, strikeouts: 1 });

    const result = applyDailyOutcomeToInning({
      outcome: 'HR',
      inning,
      score,
    });

    expect(result).toEqual({
      inning,
      score: {
        ...score,
        outs: inning.outs,
        completed: true,
      },
    });
  });
});
