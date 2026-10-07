import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyPointsSummary,
} from '@initial-baseball/shared';
import { createDailyNineCompletedComparisonInput } from './useDailyNineCompletedComparison';

const puzzle = {
  id: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
};

describe('Daily Nine completed comparison input', () => {
  it('uses the final pending engine score before View Results', () => {
    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      points: points(49, false),
      terminalPoints: points(55, true),
    })).toEqual({
      key: {
        kind: 'completed',
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      },
      ownPoints: 55,
    });
  });

  it('binds a fractional completed points-v4 result to exact comparison identity', () => {
    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      points: points(18, false, 36),
      terminalPoints: points(18.5, true, 36),
    })).toEqual({
      key: {
        kind: 'completed',
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      },
      ownPoints: 18.5,
    });
  });

  it('binds the durable first result identity into a completed comparison read', () => {
    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      points: points(18.5, true, 36),
      terminalPoints: null,
      excludedResultId: 'attempt-one',
    })).toMatchObject({
      key: { excludedResultId: 'attempt-one' },
      ownPoints: 18.5,
    });
  });

  it('keeps the same semantic input after the final score is committed', () => {
    const pending = createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      points: points(49, false),
      terminalPoints: points(55, true),
    });
    const committed = createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      points: points(55, true),
      terminalPoints: null,
    });

    expect(committed).toEqual(pending);
  });

  it('reads completed averages during play using exact identity and first-result exclusion', () => {
    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      points: points(8, false, 36),
      terminalPoints: null,
      excludedResultId: 'initial-attempt',
    })).toEqual({
      key: {
        kind: 'completed',
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
        excludedResultId: 'initial-attempt',
      },
      ownPoints: null,
    });
  });

  it('does not read for Classic', () => {
    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      points: points(0, true),
      terminalPoints: null,
    })).toBeNull();
  });
});

function points(value: number, completed: boolean, maximumPoints = 63): DailyPointsSummary {
  return {
    points: value,
    maximumPoints,
    atBatsCompleted: completed ? 9 : 8,
    totalAtBats: 9,
    completed,
  };
}
