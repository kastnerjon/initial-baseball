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

  it('uses personal total points and completed AVG in the share header', () => {
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
      'BB: 0 • AVG: 7.0',
      'KGJ: 7',
      '',
      'https://example.test/',
    ].join('\n'));
  });

  it('keeps personal total points when completed AVG is withheld', () => {
    const base = [
      'Daily Nine #149',
      'by Initial Baseball',
      '',
      '38/63 PTS · 1 K',
      '',
      'BB: K',
      '',
      'https://example.test/',
    ].join('\n');

    expect(createDailyNineScorecardShareText(
      base,
      38,
      {
        status: 'success',
        ownPoints: 38,
        completedGameCount: 1,
        averageTotalPoints: 32.5,
        strictLowerFinishRate: 0,
      },
      { 1: 0 },
      {},
    )).toContain('\n38 PTS\n');
  });
});
