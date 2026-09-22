import { describe, expect, it } from 'vitest';
import {
  addDailyNineAverageToShareText,
  createDailyNineScorecardAverage,
} from './dailyNineCompletedComparisonPresentation';

describe('Daily Nine scorecard average presentation', () => {
  it('withholds loading, unavailable and tiny-sample averages', () => {
    expect(createDailyNineScorecardAverage({ status: 'loading', ownPoints: 41 })).toBeNull();
    expect(createDailyNineScorecardAverage({ status: 'unavailable', ownPoints: 41 })).toBeNull();
    expect(createDailyNineScorecardAverage({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 0,
    })).toBeNull();
  });

  it('labels 2–9 as early and 10+ as normal using the existing completed population', () => {
    expect(createDailyNineScorecardAverage({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 7,
      averageTotalPoints: 34.26,
      strictLowerFinishRate: 0.5,
    })).toEqual({
      label: 'Early AVG',
      value: '34.3',
      note: '7 completed results',
      shareLine: 'Early AVG 34.3 · 7 completed results',
    });

    expect(createDailyNineScorecardAverage({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 19,
      averageTotalPoints: 33.5,
      strictLowerFinishRate: 0.63,
    })).toEqual({
      label: 'AVG',
      value: '33.5',
      note: '19 completed results',
      shareLine: 'AVG 33.5 · 19 completed results',
    });
  });

  it('adds only the whole-game AVG line to the spoiler-safe share text', () => {
    const base = [
      'Daily Nine #146',
      'by Initial Baseball',
      '',
      '41/63 PTS · 2 K',
      '',
      'JR: HR',
      '',
      'https://example.test/',
    ].join('\n');
    const average = createDailyNineScorecardAverage({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 12,
      averageTotalPoints: 34.25,
      strictLowerFinishRate: 0.5,
    });

    expect(addDailyNineAverageToShareText(base, average)).toBe([
      'Daily Nine #146',
      'by Initial Baseball',
      '',
      '41/63 PTS · 2 K',
      'AVG 34.3 · 12 completed results',
      '',
      'JR: HR',
      '',
      'https://example.test/',
    ].join('\n'));
    expect(addDailyNineAverageToShareText(base, null)).toBe(base);
  });
});
