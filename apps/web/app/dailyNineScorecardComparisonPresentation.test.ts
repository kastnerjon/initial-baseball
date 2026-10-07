import { describe, expect, it } from 'vitest';
import {
  createDailyNineScorecardAtBatAverage,
  createDailyNineScorecardRows,
  createDailyNineScorecardShareText,
  formatDailyNineScorecardShareTable,
} from './dailyNineScorecardComparisonPresentation';

describe('Daily Nine scorecard comparison presentation', () => {
  it('withholds unavailable and empty averages but shows one other result', () => {
    expect(createDailyNineScorecardAtBatAverage(undefined)).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({ status: 'loading' })).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({ status: 'unavailable' })).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({
      status: 'success',
      resolvedAtBatCount: 0,
      averagePoints: null,
    })).toBeNull();
    expect(createDailyNineScorecardAtBatAverage({
      status: 'success',
      resolvedAtBatCount: 1,
      averagePoints: 7,
    })).toBe('7.0');
  });

  it('creates one shared initials / outcome / score / average row model', () => {
    expect(createDailyNineScorecardRows(
      [{ initials: 'BB', outcome: 'K' }, { initials: 'KGJ', outcome: 'HR' }],
      { 1: 0, 2: 7 },
      {
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      },
    )).toEqual([
      { pitchNumber: 1, initials: 'BB', outcome: 'K', score: '0', average: '7.0' },
      { pitchNumber: 2, initials: 'KGJ', outcome: 'HR', score: '7', average: '6.0' },
    ]);
  });

  it('renders fractional v4-style scores and averages without integer rounding', () => {
    expect(createDailyNineScorecardRows(
      [{ initials: 'DW', outcome: 'BB' }, { initials: 'CCS', outcome: '2B' }],
      { 1: 0.5, 2: 2 },
      {
        1: { status: 'success', resolvedAtBatCount: 4, averagePoints: 1.375 },
        2: { status: 'success', resolvedAtBatCount: 5, averagePoints: 2.2 },
      },
    )).toEqual([
      { pitchNumber: 1, initials: 'DW', outcome: 'BB', score: '0.5', average: '1.4' },
      { pitchNumber: 2, initials: 'CCS', outcome: '2B', score: '2', average: '2.2' },
    ]);
  });

  it('formats a fixed-width share table from the same rows', () => {
    expect(formatDailyNineScorecardShareTable([
      { pitchNumber: 1, initials: 'BB', outcome: 'K', score: '0', average: '7.0' },
      { pitchNumber: 2, initials: 'KGJ', outcome: 'HR', score: '7', average: '—' },
    ])).toEqual([
      '       SCORE   AVG',
      'BB:        0   7.0',
      'KGJ:       7     —',
    ]);
  });

  it('keeps fractional totals and row scores in scorecard share text', () => {
    const base = [
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '18.5/36 PTS · 1 K',
      '',
      'DW: BB',
      '',
      'https://example.test/',
    ].join('\n');

    expect(createDailyNineScorecardShareText(
      base,
      18.5,
      {
        status: 'success',
        ownPoints: 18.5,
        completedGameCount: 20,
        averageTotalPoints: 17.25,
        strictLowerFinishRate: 0.625,
      },
      [{ initials: 'DW', outcome: 'BB' }],
      { 1: 0.5 },
      {
        1: { status: 'success', resolvedAtBatCount: 4, averagePoints: 1.375 },
      },
    )).toBe([
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '18.5 PTS • AVG 17.3',
      '',
      '       SCORE   AVG',
      'DW:      0.5   1.4',
      '',
      'https://example.test/',
    ].join('\n'));
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
      'KGJ:       7   6.0',
      '',
      'https://example.test/',
    ].join('\n'));
  });
});
