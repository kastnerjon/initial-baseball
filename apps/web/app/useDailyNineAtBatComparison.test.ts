import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import {
  createDailyNineAtBatComparisonInput,
  createDailyNineAtBatComparisonState,
} from './useDailyNineAtBatComparison';

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

const comparisonKey = {
  kind: 'at-bat',
  puzzleId: puzzle.id,
  puzzleDate: puzzle.puzzleDate,
  puzzleNumber: puzzle.puzzleNumber,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
  pitchNumber: 3,
} as const;

describe('Daily Nine at-bat comparison input', () => {
  it('binds an active points-v3 at-bat to exact identity before own points exist', () => {
    expect(createDailyNineAtBatComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitch: { pitchNumber: 3 },
      result: null,
      currentPoints: 9,
      terminalPoints: null,
    })).toEqual({
      key: comparisonKey,
      ownPoints: null,
    });

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
    })).toEqual({
      key: comparisonKey,
      ownPoints: null,
    });
  });

  it('adds engine-derived own points without changing the active comparison key', () => {
    expect(createDailyNineAtBatComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitch: { pitchNumber: 3 },
      result: terminalResult,
      currentPoints: 9,
      terminalPoints: 15,
    })).toEqual({
      key: comparisonKey,
      ownPoints: 6,
    });
  });

  it('does not activate Daily Nine comparison for non-points-v3 play', () => {
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

describe('Daily Nine at-bat comparison presentation state', () => {
  it('keeps prefetched comparison data hidden until own points exist', () => {
    expect(createDailyNineAtBatComparisonState({
      status: 'success',
      resolvedAtBatCount: 12,
      averagePoints: 4.5,
    }, null)).toEqual({ status: 'idle' });

    expect(createDailyNineAtBatComparisonState({ status: 'unavailable' }, null))
      .toEqual({ status: 'idle' });
  });

  it('projects the existing read state once the at-bat is terminal', () => {
    expect(createDailyNineAtBatComparisonState({ status: 'loading' }, 6))
      .toEqual({ status: 'loading', ownPoints: 6 });
    expect(createDailyNineAtBatComparisonState({
      status: 'success',
      resolvedAtBatCount: 12,
      averagePoints: 4.5,
    }, 6)).toEqual({
      status: 'success',
      ownPoints: 6,
      resolvedAtBatCount: 12,
      averagePoints: 4.5,
    });
    expect(createDailyNineAtBatComparisonState({ status: 'unavailable' }, 6))
      .toEqual({ status: 'unavailable', ownPoints: 6 });
  });
});
