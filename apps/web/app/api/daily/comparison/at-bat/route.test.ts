import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const server = vi.hoisted(() => ({
  readDailyNineAtBatComparison: vi.fn(),
}));

vi.mock('../../../../serverDailyNineComparison', () => ({
  readDailyNineAtBatComparison: server.readDailyNineAtBatComparison,
}));

import { DailyNineComparisonRequestError } from '../../../../dailyNineComparisonReadService';
import { GET } from './route';

describe('GET /api/daily/comparison/at-bat', () => {
  beforeEach(() => server.readDailyNineAtBatComparison.mockReset());

  it('passes only routing inputs to authoritative server composition', async () => {
    const result = {
      schemaVersion: 1,
      kind: 'at-bat',
      comparison: {
        puzzleId: 'authoritative-id',
        puzzleDate: '2026-09-19',
        puzzleNumber: 146,
        rulesetVersion: 'points-v3',
        pitchNumber: 3,
        resolvedAtBatCount: 4,
        averagePoints: 4.5,
      },
      freshness: {
        sourceReadAt: '2026-09-19T23:30:00.000Z',
        cacheStatus: 'live',
      },
    };
    server.readDailyNineAtBatComparison.mockResolvedValue(result);

    const response = await GET(new Request(
      'http://localhost/api/daily/comparison/at-bat'
      + '?date=2026-09-19&ruleset=points-v3&pitch=3&puzzleId=client-choice',
    ));

    expect(server.readDailyNineAtBatComparison).toHaveBeenCalledWith({
      puzzleDate: '2026-09-19',
      rulesetVersion: 'points-v3',
      pitchNumber: '3',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(result);
  });

  it('returns sanitized request errors', async () => {
    server.readDailyNineAtBatComparison.mockRejectedValue(
      new DailyNineComparisonRequestError('invalid_request', 'hidden detail'),
    );

    const response = await GET(new Request(
      'http://localhost/api/daily/comparison/at-bat?date=nope&ruleset=points-v3&pitch=1',
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'invalid_request',
    });
  });
});
