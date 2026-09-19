import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const server = vi.hoisted(() => ({
  readDailyNineCompletedComparison: vi.fn(),
}));

vi.mock('../../../../serverDailyNineComparison', () => ({
  readDailyNineCompletedComparison: server.readDailyNineCompletedComparison,
}));

import { GET } from './route';

describe('GET /api/daily/comparison/completed', () => {
  beforeEach(() => {
    server.readDailyNineCompletedComparison.mockReset();
    vi.stubEnv('DAILY_NINE_COMPARISON_READS_ENABLED', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed before server composition when comparison reads are not activated', async () => {
    vi.stubEnv('DAILY_NINE_COMPARISON_READS_ENABLED', 'false');

    const response = await GET(new Request(
      'http://localhost/api/daily/comparison/completed?date=2026-09-19&ruleset=points-v3',
    ));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'comparison_unavailable',
    });
    expect(server.readDailyNineCompletedComparison).not.toHaveBeenCalled();
  });

  it('passes only date and ruleset to authoritative server composition', async () => {
    const result = {
      schemaVersion: 1,
      kind: 'completed',
      comparison: {
        puzzleId: 'authoritative-id',
        puzzleDate: '2026-09-19',
        puzzleNumber: 146,
        rulesetVersion: 'points-v3',
        completedGameCount: 2,
        averageTotalPoints: 34.5,
        scoreHistogram: Array.from({ length: 64 }, () => 0),
      },
      freshness: {
        sourceReadAt: '2026-09-19T23:30:00.000Z',
        cacheStatus: 'live',
      },
    };
    server.readDailyNineCompletedComparison.mockResolvedValue(result);

    const response = await GET(new Request(
      'http://localhost/api/daily/comparison/completed'
      + '?date=2026-09-19&ruleset=points-v3&puzzleNumber=999',
    ));

    expect(server.readDailyNineCompletedComparison).toHaveBeenCalledWith({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(result);
  });

});
