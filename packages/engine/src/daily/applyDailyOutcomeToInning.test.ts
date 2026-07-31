import { describe, expect, it } from 'vitest';
import {
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  type DailyInningState,
  type DailyScoreSummary,
} from '@initial-baseball/shared';
import { applyDailyOutcomeToInning } from './applyDailyOutcomeToInning.js';
import { applyDailyOutcomeForRuleset, createDailyPointsSummary } from './applyDailyRuleset.js';

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

describe('applyDailyOutcomeForRuleset', () => {
  it('keeps points-v1 active after three strikeouts and continues scoring later at-bats', () => {
    let state = {
      inning: baseInning({ first: false, second: false, third: false }),
      score: baseScore(),
      points: createDailyPointsSummary(POINTS_V1_DAILY_RULESET_VERSION, 9),
    };

    for (let index = 0; index < 3; index += 1) {
      state = applyDailyOutcomeForRuleset({
        ...state,
        rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
        outcome: 'K',
        totalAtBats: 9,
      });
    }

    expect(state.inning.outs).toBe(3);
    expect(state.score).toMatchObject({ strikeouts: 3, completed: false });
    expect(state.points).toMatchObject({ points: 0, atBatsCompleted: 3, completed: false });

    state = applyDailyOutcomeForRuleset({
      ...state,
      rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
      outcome: 'HR',
      totalAtBats: 9,
    });

    expect(state.points).toMatchObject({ points: 5, maximumPoints: 45, atBatsCompleted: 4, completed: false });
    expect(state.score.completed).toBe(false);
  });

  it('completes points-v1 only after the ninth scheduled at-bat', () => {
    let state = {
      inning: baseInning({ first: false, second: false, third: false }),
      score: baseScore(),
      points: createDailyPointsSummary(POINTS_V1_DAILY_RULESET_VERSION, 9),
    };

    for (let index = 0; index < 9; index += 1) {
      state = applyDailyOutcomeForRuleset({
        ...state,
        rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
        outcome: index === 8 ? 'BB' : 'HR',
        totalAtBats: 9,
      });
    }

    expect(state.points).toEqual({
      points: 41,
      maximumPoints: 45,
      atBatsCompleted: 9,
      totalAtBats: 9,
      completed: true,
    });
    expect(state.score.completed).toBe(true);
  });

  it('preserves legacy three-out completion as a separate versioned policy', () => {
    const state = applyDailyOutcomeForRuleset({
      inning: baseInning({ first: false, second: false, third: false }, 2),
      score: baseScore({ outs: 2 }),
      points: createDailyPointsSummary(LEGACY_DAILY_RULESET_VERSION, 9),
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
      outcome: 'K',
      totalAtBats: 9,
    });

    expect(state.score.completed).toBe(true);
    expect(state.points).toMatchObject({ points: 0, maximumPoints: 0, atBatsCompleted: 1, completed: true });
  });
});
