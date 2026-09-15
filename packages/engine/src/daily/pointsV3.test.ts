import { describe, expect, it } from 'vitest';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import {
  applyDailyOutcomeForRuleset,
  createDailyPointsSummary,
  getDailyAtBatPoints,
  getDailyAtBatPointsRemaining,
  getDailyMaximumPoints,
} from './applyDailyRuleset.js';

describe('points-v3 Daily Nine scoring', () => {
  it.each([
    [0, 0, 7],
    [1, 0, 6],
    [2, 0, 5],
    [3, 0, 4],
    [4, 0, 3],
    [0, 1, 6],
    [2, 2, 3],
    [4, 2, 1],
  ] as const)('subtracts hints and wrong guesses (%s, %s) from seven points', (hintsRevealed, wrongGuesses, expected) => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: 'HR',
      hintsRevealed,
      wrongGuesses,
    })).toBe(expected);
  });

  it('awards zero for a third-strikeout outcome regardless of prior hints', () => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: 'K',
      hintsRevealed: 4,
      wrongGuesses: 2,
    })).toBe(0);
  });

  it('caps malformed negative scoring inputs at the seven-point maximum', () => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: 'HR',
      hintsRevealed: -1,
      wrongGuesses: -4,
    })).toBe(7);
    expect(getDailyMaximumPoints(POINTS_V3_DAILY_RULESET_VERSION, 9)).toBe(63);
  });

  it('awards zero once the third wrong guess is reached', () => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: 'HR',
      hintsRevealed: 0,
      wrongGuesses: 3,
    })).toBe(0);
  });

  it.each([
    [0, 0, 7],
    [1, 0, 6],
    [0, 2, 5],
    [4, 2, 1],
    [0, 3, 0],
  ] as const)('reports live points remaining (%s hints, %s wrong guesses)', (hintsRevealed, wrongGuesses, expected) => {
    expect(getDailyAtBatPointsRemaining({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      hintsRevealed,
      wrongGuesses,
    })).toBe(expected);
  });

  it('reports zero after an at-bat is complete and no live value for compatibility rulesets', () => {
    expect(getDailyAtBatPointsRemaining({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      atBatComplete: true,
    })).toBe(0);
    expect(getDailyAtBatPointsRemaining({
      rulesetVersion: POINTS_V2_DAILY_RULESET_VERSION,
    })).toBeNull();
  });

  it('uses the verified terminal facts when accumulating points', () => {
    const initial = {
      inning: {
        inningNumber: 1 as const,
        outs: 0,
        maxOuts: 3,
        bases: { first: false, second: false, third: false },
        completedAtBats: [],
        currentAtBat: null,
      },
      score: { runs: 0, hits: 0, outs: 0, strikeouts: 0, completed: false },
      points: createDailyPointsSummary(POINTS_V3_DAILY_RULESET_VERSION, 9),
    };
    const next = applyDailyOutcomeForRuleset({
      ...initial,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: '3B',
      hintsRevealed: 1,
      wrongGuesses: 1,
      totalAtBats: 9,
    });

    expect(next.points).toMatchObject({ points: 5, maximumPoints: 63, atBatsCompleted: 1, completed: false });
  });

  it('leaves points-v2 outcome scoring unchanged', () => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V2_DAILY_RULESET_VERSION,
      outcome: 'BB',
      hintsRevealed: 4,
      wrongGuesses: 2,
    })).toBe(0.5);
  });
});
