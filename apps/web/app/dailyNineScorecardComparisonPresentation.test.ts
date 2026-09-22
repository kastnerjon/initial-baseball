import { describe, expect, it } from 'vitest';
import {
  addDailyNineAtBatAveragesToShareText,
  createDailyNineScorecardAtBatAverage,
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

  it('decorates each share-safe AB line without adding answers', () => {
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

    expect(addDailyNineAtBatAveragesToShareText(base, {
      1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 4.76 },
      2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 7 },
    })).toBe([
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '38/63 PTS · 1 K',
      '',
      'BB: K · AVG 4.8',
      'KGJ: HR',
      '',
      'https://example.test/',
    ].join('\n'));
  });
});
