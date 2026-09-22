import { describe, expect, it } from 'vitest';
import {
  createDailyNineScorecardAtBatAverage,
  createDailyNineScorecardShareText,
} from './dailyNineScorecardComparisonPresentation';

describe('Daily Nine per-at-bat scorecard comparison presentation', () => {
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

  it('formats a displayable AB average as ordinary one-decimal points', () => {
    expect(createDailyNineScorecardAtBatAverage({
      status: 'success',
      resolvedAtBatCount: 2,
      averagePoints: 4.76,
    })).toBe('4.8');
  });

  it('replaces baseball outcomes with personal points in spoiler-safe Daily Nine share rows', () => {
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
      { 1: 0, 2: 7 },
      {
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      },
    )).toBe([
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '38/63 PTS · 1 K',
      '',
      'BB: 0 • AVG: 7.0',
      'KGJ: 7',
      '',
      'https://example.test/',
    ].join('\n'));
  });
});
