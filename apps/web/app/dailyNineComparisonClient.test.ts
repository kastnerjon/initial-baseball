import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import {
  createDailyNineComparisonClient,
  DailyNineComparisonClientError,
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
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=3',
      { method: 'GET', cache: 'no-store', signal },
    );
  });

  it('reads completed comparison independently from the at-bat route', async () => {
    const signal = new AbortController().signal;
    const request = vi.fn().mockResolvedValue(response(200, completedPayload()));
    const client = createDailyNineComparisonClient({ request });

    await expect(client.readCompleted(COMPLETED_KEY, signal)).resolves.toEqual(completedPayload());
    expect(request).toHaveBeenCalledExactlyOnceWith(
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
      .rejects.toMatchObject<Partial<DailyNineComparisonClientError>>({
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
      .rejects.toMatchObject<Partial<DailyNineComparisonClientError>>({
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
      .rejects.toMatchObject<Partial<DailyNineComparisonClientError>>({
        kind: 'http',
        status: 503,
        code: 'comparison_unavailable',
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
      .rejects.toMatchObject<Partial<DailyNineComparisonClientError>>({
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

function completedPayload() {
  return {
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    kind: 'completed' as const,
    comparison: {
      ...baseComparison(),
      completedGameCount: 2,
      averageTotalPoints: 28.5,
      scoreHistogram: Array.from({ length: 64 }, (_, points) =>
        points === 21 || points === 36 ? 1 : 0),
    },
    freshness: {
      sourceReadAt: '2026-09-20T01:00:00.000Z',
      cacheStatus: 'live' as const,
    },
  };
}

function baseComparison() {
  return { ...BASE };
}
