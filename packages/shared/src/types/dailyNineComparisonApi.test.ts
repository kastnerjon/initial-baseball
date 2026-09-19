import { describe, expect, expectTypeOf, it } from 'vitest';
import { POINTS_V3_DAILY_RULESET_VERSION } from './daily.js';
import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  type DailyNineAtBatComparisonApiResponse,
  type DailyNineCompletedComparisonApiResponse,
  type DailyNineComparisonApiErrorResponse,
  type DailyNineComparisonApiSuccess,
} from './dailyNineComparisonApi.js';

const KEY = {
  puzzleId: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

describe('Daily Nine comparison API contract', () => {
  it('versions comparison transport independently from result schemas', () => {
    expect(DAILY_NINE_COMPARISON_API_SCHEMA_VERSION).toBe(1);
  });

  it('represents live and cached freshness without changing comparison identity', () => {
    const live: DailyNineAtBatComparisonApiResponse = {
      schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
      kind: 'at-bat',
      comparison: {
        ...KEY,
        pitchNumber: 4,
        resolvedAtBatCount: 12,
        averagePoints: 3.25,
      },
      freshness: {
        sourceReadAt: '2026-09-19T21:00:00.000Z',
        cacheStatus: 'live',
      },
    };
    const cached: DailyNineAtBatComparisonApiResponse = {
      ...live,
      freshness: {
        sourceReadAt: live.freshness.sourceReadAt,
        cacheStatus: 'cached',
      },
    };

    expect(cached.comparison).toEqual(live.comparison);
    expect(cached.freshness.sourceReadAt).toBe(live.freshness.sourceReadAt);
    expect(cached.freshness.cacheStatus).toBe('cached');
  });

  it('keeps completed-game distribution separate from at-bat comparison', () => {
    const completed: DailyNineCompletedComparisonApiResponse = {
      schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
      kind: 'completed',
      comparison: {
        ...KEY,
        completedGameCount: 2,
        averageTotalPoints: 34.5,
        scoreHistogram: Array.from({ length: 64 }, (_, points) =>
          points === 31 || points === 38 ? 1 : 0),
      },
      freshness: {
        sourceReadAt: '2026-09-19T21:00:00.000Z',
        servedAt: '2026-09-19T21:00:00.004Z',
        cacheStatus: 'live',
      },
    };

    expect(completed.comparison.completedGameCount).toBe(2);
    expect(completed.comparison.scoreHistogram[31]).toBe(1);
    expect(completed.comparison.scoreHistogram[38]).toBe(1);
    expectTypeOf<DailyNineComparisonApiSuccess>().toMatchTypeOf<
      DailyNineAtBatComparisonApiResponse | DailyNineCompletedComparisonApiResponse
    >();
  });

  it('keeps unavailable reads separate from malformed or unsupported requests', () => {
    const unavailable: DailyNineComparisonApiErrorResponse = {
      schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
      error: 'comparison_unavailable',
    };
    const unsupported: DailyNineComparisonApiErrorResponse = {
      schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
      error: 'unsupported_ruleset',
    };

    expect(unavailable.error).toBe('comparison_unavailable');
    expect(unsupported.error).toBe('unsupported_ruleset');
  });
});
