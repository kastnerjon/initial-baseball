import { describe, expect, it } from 'vitest';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import {
  applyDailyOutcomeForRuleset,
  createDailyPointsSummary,
  getDailyAtBatPoints,
  getDailyAtBatPointsRemaining,
  getDailyMaximumPoints,
  getDailyPointsRange,
  type DailyRulesetEngineState,
} from './applyDailyRuleset.js';
import { normalizeDailyTerminalAtBat } from './normalizeDailyTerminalAtBat.js';

describe('points-v4 Daily Nine scoring', () => {
  it.each([
    [0, 'HR', 4],
    [1, '3B', 3],
    [2, '2B', 2],
    [3, '1B', 1],
    [4, 'BB', 0.5],
  ] as const)('maps %s revealed hints to %s worth %s points', (hintsRevealed, outcome, expected) => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      outcome,
      hintsRevealed,
      wrongGuesses: 0,
    })).toBe(expected);
  });

  it.each([0, 1, 2] as const)('does not deduct for %s nonterminal wrong guesses', (wrongGuesses) => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      outcome: '2B',
      hintsRevealed: 2,
      wrongGuesses,
    })).toBe(2);
  });

  it('scores a third wrong guess and any K terminal outcome at zero', () => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      outcome: 'HR',
      hintsRevealed: 0,
      wrongGuesses: 3,
    })).toBe(0);
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      outcome: 'K',
      hintsRevealed: 4,
      wrongGuesses: 0,
    })).toBe(0);
  });

  it('normalizes Give Up to K so it uses the same zero-point terminal rule', () => {
    const normalized = normalizeDailyTerminalAtBat({
      pitchNumber: 1,
      initials: 'AB',
      outcome: 'K',
      hintsRevealed: 2,
      wrongGuesses: 0,
      resolution: 'give_up',
    }, {
      pitchNumber: 1,
      initials: 'AB',
    });

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(getDailyAtBatPoints({
      ...normalized.atBat,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    })).toBe(0);
  });

  it.each([
    [0, 4],
    [1, 3],
    [2, 2],
    [3, 1],
    [4, 0.5],
  ] as const)('reports %s-hint live allowance as %s points', (hintsRevealed, expected) => {
    expect(getDailyAtBatPointsRemaining({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      hintsRevealed,
      wrongGuesses: 2,
    })).toBe(expected);
  });

  it('reports the terminal third strike defensively and zero after completion', () => {
    expect(getDailyAtBatPointsRemaining({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      hintsRevealed: 0,
      wrongGuesses: 3,
    })).toBe(0);
    expect(getDailyAtBatPointsRemaining({
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      hintsRevealed: 0,
      wrongGuesses: 3,
      atBatComplete: true,
    })).toBe(0);
  });

  it('defines the non-negative nine-at-bat score range and half-point step', () => {
    expect(getDailyMaximumPoints(POINTS_V4_DAILY_RULESET_VERSION, 9)).toBe(36);
    expect(getDailyPointsRange(POINTS_V4_DAILY_RULESET_VERSION, 9)).toEqual({
      minimumPoints: 0,
      maximumPoints: 36,
      step: 0.5,
    });
  });

  it('plays all nine at-bats despite strikeouts and reaches the zero-point minimum', () => {
    let state = createInitialState(POINTS_V4_DAILY_RULESET_VERSION);
    for (let index = 0; index < 9; index += 1) {
      state = applyDailyOutcomeForRuleset({
        ...state,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
        outcome: 'K',
        hintsRevealed: 0,
        wrongGuesses: 3,
        totalAtBats: 9,
      });
      if (index === 2) {
        expect(state.points.completed).toBe(false);
      }
    }

    expect(state.points).toMatchObject({
      points: 0,
      maximumPoints: 36,
      atBatsCompleted: 9,
      completed: true,
    });
  });

  it('accumulates half-point walks exactly across the game', () => {
    let state = createInitialState(POINTS_V4_DAILY_RULESET_VERSION);
    for (let index = 0; index < 9; index += 1) {
      state = applyDailyOutcomeForRuleset({
        ...state,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
        outcome: 'BB',
        hintsRevealed: 4,
        wrongGuesses: 2,
        totalAtBats: 9,
      });
    }

    expect(state.points).toMatchObject({
      points: 4.5,
      maximumPoints: 36,
      atBatsCompleted: 9,
      completed: true,
    });
  });

  it('reaches the nine-at-bat maximum with nine home runs', () => {
    let state = createInitialState(POINTS_V4_DAILY_RULESET_VERSION);
    for (let index = 0; index < 9; index += 1) {
      state = applyDailyOutcomeForRuleset({
        ...state,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
        outcome: 'HR',
        hintsRevealed: 0,
        wrongGuesses: 0,
        totalAtBats: 9,
      });
    }

    expect(state.points).toMatchObject({
      points: 36,
      maximumPoints: 36,
      atBatsCompleted: 9,
      completed: true,
    });
  });

  it('leaves historical points-v3 scoring and range unchanged', () => {
    expect(getDailyAtBatPoints({
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      outcome: 'HR',
      hintsRevealed: 2,
      wrongGuesses: 1,
    })).toBe(4);
    expect(getDailyPointsRange(POINTS_V3_DAILY_RULESET_VERSION, 9)).toEqual({
      minimumPoints: 0,
      maximumPoints: 63,
      step: 1,
    });
  });
});

function createInitialState(
  rulesetVersion: typeof POINTS_V4_DAILY_RULESET_VERSION,
): DailyRulesetEngineState {
  return {
    inning: {
      inningNumber: 1 as const,
      outs: 0,
      maxOuts: 3,
      bases: { first: false, second: false, third: false },
      completedAtBats: [],
      currentAtBat: null,
    },
    score: { runs: 0, hits: 0, outs: 0, strikeouts: 0, completed: false },
    points: createDailyPointsSummary(rulesetVersion, 9),
  };
}
