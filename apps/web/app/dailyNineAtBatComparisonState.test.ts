import { describe, expect, it } from 'vitest';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import {
  createDailyNineAtBatComparisonInput,
  createDailyNineAtBatComparisonState,
} from './dailyNineAtBatComparisonState';

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

  it('binds points-v4 and preserves a fractional terminal score', () => {
    expect(createDailyNineAtBatComparisonInput({
      puzzle,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      pitch: { pitchNumber: 3 },
      result: terminalResult,
      currentPoints: 10,
      terminalPoints: 10.5,
    })).toEqual({
      key: {
        ...comparisonKey,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      },
      ownPoints: 0.5,
    });
  });

  it('does not activate Daily Nine comparison for unsupported play', () => {
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

  it('projects the existing cached read once the at-bat is terminal', () => {
    expect(createDailyNineAtBatComparisonState(undefined, 6))
      .toEqual({ status: 'loading', ownPoints: 6 });
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
      strictLowerAtBatRate: null,
    });
    expect(createDailyNineAtBatComparisonState({ status: 'unavailable' }, 6))
      .toEqual({ status: 'unavailable', ownPoints: 6 });
  });

  it('uses strict-lower semantics with one other v4 result', () => {
    const readState = {
      status: 'success' as const,
      resolvedAtBatCount: 1,
      averagePoints: 2,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      scoreHistogram: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    };

    expect(createDailyNineAtBatComparisonState(readState, 4)).toMatchObject({
      strictLowerAtBatRate: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      scoreHistogram: readState.scoreHistogram,
    });
    expect(createDailyNineAtBatComparisonState(readState, 2)).toMatchObject({
      strictLowerAtBatRate: 0,
    });
    expect(createDailyNineAtBatComparisonState(readState, 0.5)).toMatchObject({
      strictLowerAtBatRate: 0,
    });
  });
});
