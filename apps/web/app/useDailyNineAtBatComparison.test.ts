import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { createDailyNineAtBatComparisonInput } from './useDailyNineAtBatComparison';

const puzzle = {
  id: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
};

const terminalResult = {
  kind: 'correct',
  revealedCount: 0,
  outcome: 'HR',
  source: 'initials',
} as const;

describe('Daily Nine at-bat comparison input', () => {
  it('binds a terminal points-v3 result to exact puzzle and pitch identity', () => {
    expect(createDailyNineAtBatComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitch: { pitchNumber: 3 },
      result: terminalResult,
      currentPoints: 9,
      terminalPoints: 15,
    })).toEqual({
      key: {
        kind: 'at-bat',
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
        pitchNumber: 3,
      },
      ownPoints: 6,
    });
  });

  it('does not create a comparison read for active or non-points-v3 play', () => {
    expect(createDailyNineAtBatComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitch: { pitchNumber: 3 },
      result: {
        kind: 'incorrect',
        revealedCount: 0,
        strikeCount: 1,
        remainingStrikes: 2,
      },
      currentPoints: 9,
      terminalPoints: null,
    })).toBeNull();

    expect(createDailyNineAtBatComparisonInput({
      puzzle,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      pitch: { pitchNumber: 3 },
      result: terminalResult,
      currentPoints: 0,
      terminalPoints: 0,
    })).toBeNull();
  });
});
