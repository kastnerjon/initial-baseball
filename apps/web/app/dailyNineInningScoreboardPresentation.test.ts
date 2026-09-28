import { describe, expect, it } from 'vitest';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createDailyNineInningScoreboardPresentation } from './dailyNineInningScoreboardPresentation';

const pitches = [
  { pitchNumber: 1, initials: 'RM' },
  { pitchNumber: 2, initials: 'JM' },
];

describe('Daily Nine inning scoreboard comparison presentation', () => {
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
      gameCompleted: false,
      completedComparison: { status: 'idle' },
    });

    expect(scoreboard.columns[0]?.user.display).toBe('—');
    expect(scoreboard.columns[0]?.average.display).toBe('2.3');
    expect(scoreboard.columns[1]?.average.display).toBe('…');
    expect(scoreboard.totalAverage.display).toBe('—');
  });

  it('keeps dash presentation for genuinely unavailable or sample-withheld AVGs', () => {
    const scoreboard = createDailyNineInningScoreboardPresentation({
      pitches,
      currentPitchNumber: 1,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      atBatPoints: {},
      atBatComparisons: {
        1: {
          status: 'success',
          resolvedAtBatCount: 1,
          averagePoints: 4,
        },
        2: { status: 'unavailable' },
      },
      totalPoints: 0,
      gameCompleted: false,
      completedComparison: { status: 'idle' },
    });

    expect(scoreboard.columns[0]?.average.display).toBe('—');
    expect(scoreboard.columns[1]?.average.display).toBe('—');
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
      gameCompleted: true,
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
      gameCompleted: true,
      completedComparison: { status: 'loading', ownPoints: 4.5 },
    });

    expect(scoreboard.totalAverage.display).toBe('…');
  });
});
