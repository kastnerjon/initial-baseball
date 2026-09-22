import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const server = vi.hoisted(() => ({
  readAtBat: vi.fn(),
  readCompleted: vi.fn(),
}));

vi.mock('./serverDailyNineComparison', () => ({
  readDailyNineAtBatComparison: server.readAtBat,
  readDailyNineCompletedComparison: server.readCompleted,
}));

import { DailyNineComparisonRequestError } from './dailyNineComparisonReadService';
import { GET as getAtBat } from './api/daily/comparison/at-bat/route';
import { GET as getCompleted } from './api/daily/comparison/completed/route';

const originalDisableFlag = process.env.DAILY_NINE_COMPARISON_READS_DISABLED;
const originalLegacyEnableFlag = process.env.DAILY_NINE_COMPARISON_READS_ENABLED;

describe('Daily Nine comparison GET adapters', () => {
  beforeEach(() => {
    delete process.env.DAILY_NINE_COMPARISON_READS_DISABLED;
    server.readAtBat.mockReset();
    server.readCompleted.mockReset();
  });

  afterAll(() => {
    if (originalDisableFlag === undefined) {
      delete process.env.DAILY_NINE_COMPARISON_READS_DISABLED;
    } else {
      process.env.DAILY_NINE_COMPARISON_READS_DISABLED = originalDisableFlag;
    }
    if (originalLegacyEnableFlag === undefined) {
      delete process.env.DAILY_NINE_COMPARISON_READS_ENABLED;
    } else {
      process.env.DAILY_NINE_COMPARISON_READS_ENABLED = originalLegacyEnableFlag;
    }
  });

  it('fails closed before loading server comparison work when the disable flag is true', async () => {
    process.env.DAILY_NINE_COMPARISON_READS_DISABLED = 'true';

    const response = await getAtBat(new Request(
      'http://localhost/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=1',
    ));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toMatch(/^daily-comparison-at-bat;dur=\d+$/);
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'comparison_unavailable',
    });
    expect(server.readAtBat).not.toHaveBeenCalled();
    expect(server.readCompleted).not.toHaveBeenCalled();
  });

  it.each(['', 'TRUE', '0', 'disabled'])(
    'fails closed for malformed explicit disable configuration %j',
    async (value) => {
      process.env.DAILY_NINE_COMPARISON_READS_DISABLED = value;

      const response = await getAtBat(new Request(
        'http://localhost/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=1',
      ));

      expect(response.status).toBe(404);
      expect(response.headers.get('server-timing')).toMatch(/^daily-comparison-at-bat;dur=\d+$/);
      expect(server.readAtBat).not.toHaveBeenCalled();
    },
  );

  it('allows an explicit false disable flag', async () => {
    process.env.DAILY_NINE_COMPARISON_READS_DISABLED = 'false';
    server.readAtBat.mockResolvedValue(atBatResponse());

    const response = await getAtBat(new Request(
      'http://localhost/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=1',
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('server-timing')).toMatch(
      /^daily-comparison-at-bat;dur=\d+, daily-comparison-compose;dur=\d+$/,
    );
    expect(server.readAtBat).toHaveBeenCalledOnce();
  });

  it('ignores the retired pre-activation enable flag', async () => {
    process.env.DAILY_NINE_COMPARISON_READS_ENABLED = 'false';
    server.readAtBat.mockResolvedValue(atBatResponse());

    const response = await getAtBat(new Request(
      'http://localhost/api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=1',
    ));

    expect(response.status).toBe(200);
    expect(server.readAtBat).toHaveBeenCalledOnce();
  });

  it('passes only routing fields to the authoritative at-bat read boundary', async () => {
    server.readAtBat.mockImplementation(async (_request, timings) => {
      timings.puzzle = 12;
      timings.provider = 34;
      return atBatResponse();
    });

    const response = await getAtBat(new Request(
      'http://localhost/api/daily/comparison/at-bat'
      + '?date=2026-09-19&ruleset=points-v3&pitch=4&puzzleId=untrusted',
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toMatch(
      /^daily-comparison-at-bat;dur=\d+, daily-comparison-compose;dur=\d+, daily-comparison-puzzle;dur=12, daily-comparison-provider;dur=34$/,
    );
    expect(server.readAtBat).toHaveBeenCalledWith({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
      pitchNumber: '4',
    }, expect.any(Object));
    expect(server.readCompleted).not.toHaveBeenCalled();
  });

  it('keeps completed reads independent and ignores user score/puzzle identity query data', async () => {
    server.readCompleted.mockImplementation(async (_request, timings) => {
      timings.puzzle = 8;
      timings.provider = 21;
      return completedResponse();
    });

    const response = await getCompleted(new Request(
      'http://localhost/api/daily/comparison/completed'
      + '?date=2026-09-19&ruleset=points-v3&score=63&puzzleId=untrusted',
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('server-timing')).toMatch(
      /^daily-comparison-completed;dur=\d+, daily-comparison-compose;dur=\d+, daily-comparison-puzzle;dur=8, daily-comparison-provider;dur=21$/,
    );
    expect(server.readCompleted).toHaveBeenCalledWith({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
    }, expect.any(Object));
    expect(server.readAtBat).not.toHaveBeenCalled();
  });

  it('maps request failures through the sanitized shared HTTP mapper', async () => {
    server.readAtBat.mockRejectedValue(
      new DailyNineComparisonRequestError('invalid_request', 'internal parsing detail'),
    );

    const response = await getAtBat(new Request(
      'http://localhost/api/daily/comparison/at-bat?date=nope&ruleset=points-v3&pitch=1',
    ));

    expect(response.status).toBe(400);
    expect(response.headers.get('server-timing')).toMatch(
      /^daily-comparison-at-bat;dur=\d+, daily-comparison-compose;dur=\d+$/,
    );
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'invalid_request',
    });
  });

  it('maps unexpected server faults without leaking details', async () => {
    server.readCompleted.mockRejectedValue(new Error('sensitive internal detail'));

    const response = await getCompleted(new Request(
      'http://localhost/api/daily/comparison/completed?date=2026-09-19&ruleset=points-v3',
    ));

    expect(response.status).toBe(500);
    expect(response.headers.get('server-timing')).toMatch(
      /^daily-comparison-completed;dur=\d+, daily-comparison-compose;dur=\d+$/,
    );
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'comparison_unavailable',
    });
  });
});

function atBatResponse() {
  return {
    schemaVersion: 1 as const,
    kind: 'at-bat' as const,
    comparison: {
      puzzleId: 'daily-id',
      puzzleDate: '2026-09-19',
      puzzleNumber: 146,
      rulesetVersion: 'points-v3' as const,
      pitchNumber: 4,
      resolvedAtBatCount: 2,
      averagePoints: 3.5,
    },
    freshness: {
      sourceReadAt: '2026-09-19T23:30:00.000Z',
      cacheStatus: 'live' as const,
    },
  };
}

function completedResponse() {
  return {
    schemaVersion: 1 as const,
    kind: 'completed' as const,
    comparison: {
      puzzleId: 'daily-id',
      puzzleDate: '2026-09-19',
      puzzleNumber: 146,
      rulesetVersion: 'points-v3' as const,
      completedGameCount: 0,
      averageTotalPoints: null,
      scoreHistogram: Array.from({ length: 64 }, () => 0),
    },
    freshness: {
      sourceReadAt: '2026-09-19T23:30:00.000Z',
      cacheStatus: 'live' as const,
    },
  };
}
