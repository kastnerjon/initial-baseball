import { describe, expect, it } from 'vitest';
import { createDailyNineCompletedComparisonPresentation, formatDailyNineCompletedPercentile } from './dailyNineCompletedComparisonPresentation';

describe('Daily Nine completed comparison presentation', () => {
  it('keeps loading and unavailable states fail-quiet', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'loading',
      ownPoints: 41,
    })).toEqual({
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Loading comparison…',
    });
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'unavailable',
      ownPoints: 41,
    })).toEqual({
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Comparison unavailable',
    });
  });

  it('withholds only an empty other-result population', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 0,
      averageTotalPoints: null,
      strictLowerFinishRate: null,
    })).toEqual({
      average: '—',
      beat: null,
      averageStatus: null,
      statusLabel: null,
      note: 'Waiting for another completed result',
    });
  });

  it('shows pre-completion average without BEAT or personal above/below', () => {
    const presentation = createDailyNineCompletedComparisonPresentation({
      status: 'success', ownPoints: null,
      completedGameCount: 1, averageTotalPoints: 17.5, strictLowerFinishRate: null,
    });
    expect(presentation.average).toBe('17.5');
    expect(presentation.beat).toBeNull();
    expect(presentation.averageStatus).toBeNull();
    expect(presentation.statusLabel).toBeNull();
  });

  it('shows AVG and strict-lower BEAT with one other completed result', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 1,
    })).toEqual({
      average: '35.0',
      beat: '100%',
      averageStatus: 'above',
      statusLabel: 'Above AVG',
      note: "1 other completed result",
    });
  });

  it('treats an AVG tie as not above average and not beaten', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 35,
      completedGameCount: 1,
      averageTotalPoints: 35,
      strictLowerFinishRate: 0,
    })).toEqual({
      average: '35.0',
      beat: '0%',
      averageStatus: 'at-or-below',
      statusLabel: 'At or below AVG',
      note: "1 other completed result",
    });
  });

  it('formats the inclusive completed percentile while preserving historical BEAT display', () => {
    const allTied = { status: 'success' as const, ownPoints: 36,
      completedGameCount: 2, averageTotalPoints: 36, strictLowerFinishRate: 0,
      inclusiveFinishPercentile: 1 };
    expect(formatDailyNineCompletedPercentile(allTied)).toBe('100');
    expect(createDailyNineCompletedComparisonPresentation(allTied).beat).toBe('0%');
    expect(formatDailyNineCompletedPercentile({ ...allTied, ownPoints: null })).toBeNull();
    expect(formatDailyNineCompletedPercentile({ ...allTied, completedGameCount: 0 })).toBeNull();
    expect(formatDailyNineCompletedPercentile({ ...allTied, inclusiveFinishPercentile: null })).toBeNull();
    expect(formatDailyNineCompletedPercentile({ status: 'loading', ownPoints: 36 })).toBeNull();
  });

  it('does not impose a separate early-sample BEAT threshold', () => {
    expect(createDailyNineCompletedComparisonPresentation({
      status: 'success',
      ownPoints: 41,
      completedGameCount: 7,
      averageTotalPoints: 34.26,
      strictLowerFinishRate: 0.5,
    })).toEqual({
      average: '34.3',
      beat: '50%',
      averageStatus: 'above',
      statusLabel: 'Above AVG',
      note: "7 other completed results",
    });
  });
});
