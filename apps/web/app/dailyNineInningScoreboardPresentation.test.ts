import { describe, expect, it } from 'vitest';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createDailyNineInningScoreboardPresentation } from './dailyNineInningScoreboardPresentation';

const pitches = [
  { pitchNumber: 1, initials: 'RM' },
  { pitchNumber: 2, initials: 'JM' },
];

describe('Daily Nine inning scoreboard comparison presentation', () => {
  it.each([false, true])('shows unavailable AVGs when comparisons are disabled (completed=%s)', (gameCompleted) => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: gameCompleted ? null : 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      comparisonsEnabled: false,
      atBatPoints: { 1: 0.5 },
      atBatComparisons: {},
      totalPoints: 0.5,
      completedComparison: { status: 'idle' },
    });

    expect(scoreboard.columns.every(column => column.average.display === '—')).toBe(true);
    expect(scoreboard.columns[0]?.average.accessibleLabel).toContain('unavailable for this game');
    expect(scoreboard.totalAverage.display).toBe('—');
    expect(scoreboard.totalAverage.accessibleLabel).toContain('unavailable for this game');
    expect(scoreboard.totalUser.display).toBe('0.5');
  });

  it('does not display loading or cached comparisons when availability is disabled', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: null,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      comparisonsEnabled: false,
      atBatPoints: {},
      atBatComparisons: {
        1: { status: 'loading' },
        2: { status: 'success', resolvedAtBatCount: 20, averagePoints: 3 },
      },
      totalPoints: 0,
      completedComparison: {
        status: 'success', ownPoints: 0, completedGameCount: 20,
        averageTotalPoints: 12, strictLowerFinishRate: 0,
      },
    });

    expect(scoreboard.columns.every(column => column.average.display === '—')).toBe(true);
    expect(scoreboard.totalAverage.display).toBe('—');
  });

  it('shows a preloaded exact-slot AVG before the user resolves that at-bat', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: {},
      atBatComparisons: {
        1: {
          status: 'success',
          resolvedAtBatCount: 12,
          averagePoints: 2.25,
        },
        2: { status: 'loading' },
      },
      totalPoints: 0,
      completedComparison: { status: 'idle' },
    });

    expect(scoreboard.columns[0]?.user.display).toBe('—');
    expect(scoreboard.columns[0]?.average.display).toBe('2.3');
    expect(scoreboard.columns[1]?.average.display).toBe('…');
    expect(scoreboard.totalAverage.display).toBe('…');
  });

  it('keeps dash presentation for genuinely unavailable or empty AVGs', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: {},
      atBatComparisons: {
        1: {
          status: 'success',
          resolvedAtBatCount: 0,
          averagePoints: null,
        },
        2: { status: 'unavailable' },
      },
      totalPoints: 0,
      completedComparison: { status: 'idle' },
    });

    expect(scoreboard.columns[0]?.average.display).toBe('—');
    expect(scoreboard.columns[1]?.average.display).toBe('—');
  });

  it('shows an exact-slot AVG with one other result', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: {},
      atBatComparisons: {
        1: { status: 'success', resolvedAtBatCount: 1, averagePoints: 4 },
      },
      totalPoints: 0,
      completedComparison: { status: 'idle' },
    });

    expect(scoreboard.columns[0]?.average.display).toBe('4.0');
    expect(scoreboard.columns[0]?.average.accessibleLabel).toContain('1 other result');
  });

  it('shows the authoritative TOTAL AVG from one other completed game at AB 1', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: {},
      atBatComparisons: {},
      totalPoints: 0,
      completedComparison: {
        status: 'success', ownPoints: null, completedGameCount: 1,
        averageTotalPoints: 17.5, strictLowerFinishRate: null,
      },
    });
    expect(scoreboard.totalUser.display).toBe('0');
    expect(scoreboard.totalAverage.display).toBe('17.5');
    expect(scoreboard.totalAverage.accessibleLabel).toContain('1 other completed result');
  });

  it('keeps pregame loading and zero-other comparisons distinct', () => {
    const input = {
      pitches, currentPitchNumber: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: {}, atBatComparisons: {}, totalPoints: 0,
    } as const;
    expect(createDailyNineInningScoreboardPresentation({
      ...input, completedComparison: { status: 'loading', ownPoints: null },
    }).totalAverage.display).toBe('…');
    expect(createDailyNineInningScoreboardPresentation({
      ...input, completedComparison: {
        status: 'success', ownPoints: null, completedGameCount: 0,
        averageTotalPoints: null, strictLowerFinishRate: null,
      },
    }).totalAverage.display).toBe('—');
  });

  it('uses only the authoritative completed-game comparison for TOTAL AVG', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: null,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: { 1: 4, 2: 0.5 },
      atBatComparisons: {
        1: {
          status: 'success',
          resolvedAtBatCount: 20,
          averagePoints: 4,
        },
        2: {
          status: 'success',
          resolvedAtBatCount: 20,
          averagePoints: 0.5,
        },
      },
      totalPoints: 4.5,
      completedComparison: {
        status: 'success',
        ownPoints: 4.5,
        completedGameCount: 20,
        averageTotalPoints: 2.75,
        strictLowerFinishRate: 0.5,
      },
    });

    expect(scoreboard.totalUser.display).toBe('4.5');
    expect(scoreboard.totalAverage.display).toBe('2.8');
  });

  it('uses a loading glyph rather than an unavailable dash after completion while TOTAL AVG is in flight', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: null,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: { 1: 4, 2: 0.5 },
      atBatComparisons: {},
      totalPoints: 4.5,
      completedComparison: { status: 'loading', ownPoints: 4.5 },
    });

    expect(scoreboard.totalAverage.display).toBe('…');
  });
});
