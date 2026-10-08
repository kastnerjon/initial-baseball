import { describe, expect, it } from 'vitest';
import {
  createDailyNineScorecardAtBatAverage,
  createDailyNineScorecardAtBatBeat,
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

  it('formats strict-lower per-AB BEAT using the existing scoring-version histogram', () => {
    const comparison = {
      status: 'success' as const,
      rulesetVersion: 'points-v4' as const,
      resolvedAtBatCount: 4,
      averagePoints: 0.625,
      scoreHistogram: [2, 1, 0, 0, 1, 0, 0, 0, 0],
    };
    expect(createDailyNineScorecardAtBatBeat(2, comparison)).toBe('75%');
    expect(createDailyNineScorecardAtBatBeat(0, comparison)).toBe('0%');
    expect(createDailyNineScorecardAtBatBeat(undefined, comparison)).toBeNull();
    expect(createDailyNineScorecardAtBatBeat(2, { status: 'loading' })).toBeNull();
    expect(createDailyNineScorecardAtBatBeat(2, {
      status: 'success', resolvedAtBatCount: 0, averagePoints: null,
    })).toBeNull();
    expect(createDailyNineScorecardAtBatBeat(2, {
      status: 'success', resolvedAtBatCount: 1, averagePoints: 2,
      rulesetVersion: 'points-v4', scoreHistogram: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    })).toBe('0%'); // tie not beaten
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
      { pitchNumber: 1, initials: 'BB', outcome: 'K', score: '0', average: '7.0', beat: '—' },
      { pitchNumber: 2, initials: 'KGJ', outcome: 'HR', score: '7', average: '6.0', beat: '—' },
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
      { pitchNumber: 1, initials: 'DW', outcome: 'BB', score: '0.5', average: '1.4', beat: '—' },
      { pitchNumber: 2, initials: 'CCS', outcome: '2B', score: '2', average: '2.2', beat: '—' },
    ]);
  });

  it('formats a fixed-width share table from the same rows', () => {
    expect(formatDailyNineScorecardShareTable([
      { pitchNumber: 1, initials: 'BB', outcome: 'K', score: '0', average: '7.0', beat: '—' },
      { pitchNumber: 2, initials: 'KGJ', outcome: 'HR', score: '7', average: '—', beat: '—' },
    ])).toEqual([
      '       SCORE   AVG   BEAT %',
      'BB:        0   7.0        —',
      'KGJ:       7     —        —',
    ]);
  });

  it('shares per-at-bat strict-lower BEAT, preserves tied results, and leaves missing values blank', () => {
    const rows = createDailyNineScorecardRows(
      [{ initials: 'BH', outcome: '2B' }, { initials: 'DE', outcome: 'K' }],
      { 1: 2, 2: 0 },
      {
        1: { status: 'success', rulesetVersion: 'points-v4', resolvedAtBatCount: 4,
          averagePoints: 0.625, scoreHistogram: [2, 1, 0, 0, 1, 0, 0, 0, 0] },
        2: { status: 'loading' },
      },
    );
    expect(rows[0]?.beat).toBe('75%');
    expect(rows[1]?.beat).toBe('—');
    expect(formatDailyNineScorecardShareTable(rows)).toContain('BH:        2   0.6      75%');
    const ties = createDailyNineScorecardRows(
      [{ initials: 'BH', outcome: '2B' }], { 1: 2 },
      { 1: { status: 'success', rulesetVersion: 'points-v4', resolvedAtBatCount: 1,
        averagePoints: 2, scoreHistogram: [0, 0, 0, 0, 1, 0, 0, 0, 0] } },
    );
    expect(ties[0]?.beat).toBe('0%');
  });

  it('omits unavailable overall comparison while retaining initials-only share rows', () => {
    const text = createDailyNineScorecardShareText(
      ['Daily Nine #149', 'by Initial Baseball', '', '4/36 PTS', '', 'BH: HR', '', 'https://example.test/'].join('\n'),
      4, { status: 'loading', ownPoints: 4 }, [{ initials: 'BH', outcome: 'HR' }], { 1: 4 }, {},
    );
    expect(text).toContain('4 PTS');
    expect(text).not.toContain('BEAT 0%');
    expect(text).toContain('BEAT %');
    expect(text).not.toContain('Bryce Harper');
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
      '18.5 PTS • AVG 17.3 • BEAT 63%',
      '',
      '       SCORE   AVG   BEAT %',
      'DW:      0.5   1.4        —',
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
      '38 PTS • AVG 32.5 • BEAT 50%',
      '',
      '       SCORE   AVG   BEAT %',
      'BB:        0   7.0        —',
      'KGJ:       7   6.0        —',
      '',
      'https://example.test/',
    ].join('\n'));
  });
});
