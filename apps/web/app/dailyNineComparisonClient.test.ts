import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyNineComparisonApiKey,
} from '@initial-baseball/shared';
import {
  createDailyNineComparisonClient,
  type DailyNineAtBatComparisonRequestKey,
  type DailyNineCompletedComparisonRequestKey,
} from './dailyNineComparisonClient';

const BASE = {
  puzzleId: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

const AT_BAT_KEY: DailyNineAtBatComparisonRequestKey = {
  kind: 'at-bat',
  ...BASE,
  pitchNumber: 3,
};

const COMPLETED_KEY: DailyNineCompletedComparisonRequestKey = {
  kind: 'completed',
  ...BASE,
};

describe('Daily Nine browser comparison client', () => {
  it('reads and validates an at-bat response with no-store and the caller signal', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn().mockResolvedValue(response(200, atBatPayload()));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readAtBat(AT_BAT_KEY, signal)).resolves.toEqual(atBatPayload());
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=3',
      { method: 'GET', cache: 'no-store', signal },
    );
  });

  it('carries and verifies an anonymous exclusion identity on both read paths', async () => {
    const signal = new AbortController().signal;
    const excludedResultId = 'attempt-one_123';
    const atBatKey = { ...AT_BAT_KEY, excludedResultId };
    const atBat = atBatPayload({ excludedResultId });
    const completedKey = { ...COMPLETED_KEY, excludedResultId };
    const completed = completedPayload({ excludedResultId });
    const request = vi.fn()
      .mockResolvedValueOnce(response(200, atBat))
      .mockResolvedValueOnce(response(200, completed));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readAtBat(atBatKey, signal)).resolves.toEqual(atBat);
    await expect(client.readCompleted(completedKey, signal)).resolves.toEqual(completed);
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=3&excludeResultId=attempt-one_123',
      { method: 'GET', cache: 'no-store', signal },
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/daily/comparison/completed?date=2026-09-19&ruleset=points-v3&excludeResultId=attempt-one_123',
      { method: 'GET', cache: 'no-store', signal },
    );
  });

  it('rejects a filtered response that does not echo the requested exclusion identity', async () => {
    const request = vi.fn().mockResolvedValue(response(200, atBatPayload()));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readAtBat(
      { ...AT_BAT_KEY, excludedResultId: 'attempt-one' },
      new AbortController().signal,
    )).rejects.toMatchObject({ kind: 'identity_mismatch' });
  });

  it('reads and validates exact points-v4 fractional comparison payloads', async () => {
    const signal = new AbortController().signal;
    const key: DailyNineAtBatComparisonRequestKey = {
      ...AT_BAT_KEY,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    };
    const payload = {
      ...atBatPayload(),
      comparison: {
        ...atBatPayload().comparison,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
        resolvedAtBatCount: 3,
        averagePoints: 1.5,
      },
    };
    const request = vi.fn().mockResolvedValue(response(200, payload));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readAtBat(key, signal)).resolves.toEqual(payload);
    expect(request).toHaveBeenCalledWith(
      '/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v4&pitch=3',
      { method: 'GET', cache: 'no-store', signal },
    );
  });

  it('reads a points-v4 completed 73-slot histogram without integer-score assumptions', async () => {
    const signal = new AbortController().signal;
    const key: DailyNineCompletedComparisonRequestKey = {
      ...COMPLETED_KEY,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
    };
    const payload = {
      ...completedPayload(),
      comparison: {
        ...completedPayload().comparison,
        rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
        completedGameCount: 2,
        averageTotalPoints: 18.5,
        scoreHistogram: Array.from({ length: 73 }, (_, index) =>
          index === 1 || index === 72 ? 1 : 0),
      },
    };
    const request = vi.fn().mockResolvedValue(response(200, payload));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readCompleted(key, signal)).resolves.toEqual(payload);
    expect(request).toHaveBeenCalledWith(
      '/api/daily/comparison/completed?date=2026-09-19&ruleset=points-v4',
      { method: 'GET', cache: 'no-store', signal },
    );
  });

  it('reads completed comparison independently from the at-bat route', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn().mockResolvedValue(response(200, completedPayload()));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readCompleted(COMPLETED_KEY, signal)).resolves.toEqual(completedPayload());
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/api/daily/comparison/completed?date=2026-09-19&ruleset=points-v3',
      { method: 'GET', cache: 'no-store', signal },
    );
  });

  it('rejects a valid payload whose authoritative identity does not match the request', async () => {
    const request = vi.fn().mockResolvedValue(response(200, atBatPayload({
      puzzleId: 'daily-other',
    })));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readAtBat(AT_BAT_KEY, new AbortController().signal))
      .rejects.toMatchObject({
        kind: 'identity_mismatch',
      });
  });

  it('rejects malformed success payloads instead of trusting a JSON cast', async () => {
    const request = vi.fn().mockResolvedValue(response(200, {
      ...atBatPayload(),
      comparison: {
        ...atBatPayload().comparison,
        resolvedAtBatCount: -1,
      },
    }));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readAtBat(AT_BAT_KEY, new AbortController().signal))
      .rejects.toMatchObject({
        kind: 'invalid_response',
      });
  });

  it('preserves only the shared sanitized error code on a failed HTTP response', async () => {
    const request = vi.fn().mockResolvedValue(response(503, {
      schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
      error: 'comparison_unavailable',
    }));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readCompleted(COMPLETED_KEY, new AbortController().signal))
      .rejects.toMatchObject({
        kind: 'http',
        status: 503,
        code: 'comparison_unavailable',
      });
  });

  it('preserves HTTP status when an error response body is not valid JSON', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new SyntaxError('bad gateway body')),
    });
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readCompleted(COMPLETED_KEY, new AbortController().signal))
      .rejects.toMatchObject({
        kind: 'http',
        status: 502,
        code: null,
      });
  });

  it('rejects malformed JSON bodies as unavailable client data', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
    });
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readCompleted(COMPLETED_KEY, new AbortController().signal))
      .rejects.toMatchObject({
        kind: 'invalid_response',
      });
  });
});

function response(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function atBatPayload(
  comparisonOverrides: Partial<ReturnType<typeof baseComparison> & {
    pitchNumber: number;
    resolvedAtBatCount: number;
    averagePoints: number | null;
  }> = {},
) {
  return {
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    kind: 'at-bat' as const,
    comparison: {
      ...baseComparison(),
      pitchNumber: 3,
      resolvedAtBatCount: 8,
      averagePoints: 3.5,
      ...comparisonOverrides,
    },
    freshness: {
      sourceReadAt: '2026-09-20T01:00:00.000Z',
      cacheStatus: 'live' as const,
    },
  };
}

function completedPayload(
  comparisonOverrides: Partial<ReturnType<typeof baseComparison> & {
    completedGameCount: number;
    averageTotalPoints: number | null;
    scoreHistogram: number[];
  }> = {},
) {
  return {
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    kind: 'completed' as const,
    comparison: {
      ...baseComparison(),
      completedGameCount: 2,
      averageTotalPoints: 28.5,
      scoreHistogram: Array.from({ length: 64 }, (_, points) =>
        points === 21 || points === 36 ? 1 : 0),
      ...comparisonOverrides,
    },
    freshness: {
      sourceReadAt: '2026-09-20T01:00:00.000Z',
      cacheStatus: 'live' as const,
    },
  };
}

function baseComparison(): DailyNineComparisonApiKey {
  return { ...BASE };
}
