import { describe, expect, it } from 'vitest';
import {
  createDailyNineScorecardAtBatAverage,
  createDailyNineScorecardRows,
  createDailyNineScorecardShareText,
  formatDailyNineScorecardShareTable,
} from './dailyNineScorecardComparisonPresentation';

describe('Daily Nine scorecard comparison presentation', () => {
  it('withholds unavailable and 0–1 observation averages', () => {
    expect(createDailyNineScorecardAtBatAverage(undefined)).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({ status: 'loading' })).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({ status: 'unavailable' })).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({
      status: 'success',
      resolvedAtBatCount: 1,
      averagePoints: 7,
    })).toBeNull();
  });

  it('creates one shared initials / score / average row model', () => {
    expect(createDailyNineScorecardRows(
      [{ initials: 'BB', outcome: 'K' }, { initials: 'KGJ', outcome: 'HR' }],
      { 1: 0, 2: 7 },
      {
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      },
    )).toEqual([
      { pitchNumber: 1, initials: 'BB', score: '0', average: '7.0' },
      { pitchNumber: 2, initials: 'KGJ', score: '7', average: '—' },
    ]);
  });

  it('formats a fixed-width share table from the same rows', () => {
    expect(formatDailyNineScorecardShareTable([
      { pitchNumber: 1, initials: 'BB', score: '0', average: '7.0' },
      { pitchNumber: 2, initials: 'KGJ', score: '7', average: '—' },
    ])).toEqual([
      '       SCORE   AVG',
      'BB:        0   7.0',
      'KGJ:       7     —',
    ]);
  });

  it('replaces native pitch lines with the grid while preserving the points-native header', () => {
    const base = [
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '38/63 PTS · 1 K',
      '',
      'BB: K',
      'KGJ: HR',
      '',
      'https://example.test/',
    ].join('\n');

    expect(createDailyNineScorecardShareText(
      base,
      38,
      {
        status: 'success',
        ownPoints: 38,
        completedGameCount: 12,
        averageTotalPoints: 32.5,
        strictLowerFinishRate: 0.5,
      },
      [{ initials: 'BB', outcome: 'K' }, { initials: 'KGJ', outcome: 'HR' }],
      { 1: 0, 2: 7 },
      {
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      },
    )).toBe([
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '38 PTS • AVG 32.5',
      '',
      '       SCORE   AVG',
      'BB:        0   7.0',
      'KGJ:       7     —',
      '',
      'https://example.test/',
    ].join('\n'));
  });
});
