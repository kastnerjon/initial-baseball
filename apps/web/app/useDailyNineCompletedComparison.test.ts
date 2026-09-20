import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
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

  it('does not read before completion or for Classic', () => {
    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      points: points(49, false),
      terminalPoints: points(52, false),
    })).toBeNull();

    expect(createDailyNineCompletedComparisonInput({
      puzzle,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      points: points(0, true),
      terminalPoints: null,
    })).toBeNull();
  });
});

function points(value: number, completed: boolean): DailyPointsSummary {
  return {
    points: value,
    maximumPoints: 63,
    atBatsCompleted: completed ? 9 : 8,
    totalAtBats: 9,
    completed,
  };
}
