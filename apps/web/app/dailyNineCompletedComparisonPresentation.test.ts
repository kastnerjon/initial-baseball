import { describe, expect, it } from 'vitest';
import { createDailyNineCompletedComparisonPresentation } from './dailyNineCompletedComparisonPresentation';

describe('Daily Nine completed comparison presentation', () => {
  it('keeps loading and unavailable states fail-quiet', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'loading',
      ownPoints: 41,
    })).toEqual({
      average: '—',
      beat: null,
      note: 'Loading comparison…',
    });
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'unavailable',
      ownPoints: 41,
    })).toEqual({
      average: '—',
      beat: null,
      note: 'Comparison unavailable',
    });
  });

  it('withholds a 0–1 sample completed-game average', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 0,
    })).toEqual({
      average: '—',
      beat: null,
      note: 'Waiting for more completed results · 1 result',
    });
  });

  it('keeps early and BEAT thresholds on the completed-game panel only', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 7,
      averageTotalPoints: 34.26,
      strictLowerFinishRate: 0.5,
    })).toEqual({
      average: '34.3',
      beat: null,
      note: 'Early average · 7 completed results',
    });

    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 20,
      averageTotalPoints: 33.5,
      strictLowerFinishRate: 0.63,
    })).toEqual({
      average: '33.5',
      beat: '63%',
      note: "20 completed results · ties aren't counted as beaten",
    });
  });
});
