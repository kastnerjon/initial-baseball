import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { DailyNineComparisonRequestError } from './dailyNineComparisonReadService';
import {
  dailyNineComparisonDisabledResponse,
  dailyNineComparisonPrivateJson,
  isDailyNineComparisonReadApiEnabled,
  mapDailyNineComparisonRouteError,
} from './dailyNineComparisonHttp';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyNineComparisonRepositoryError } from './supabaseDailyNineComparisonRepository';

describe('Daily Nine comparison HTTP helpers', () => {
  it.each([
    [{}, true],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: '' }, false],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: 'false' }, true],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: ' false ' }, true],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: 'true' }, false],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: ' true ' }, false],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: 'TRUE' }, false],
    [{ DAILY_NINE_COMPARISON_READS_DISABLED: '0' }, false],
    [{ DAILY_NINE_COMPARISON_READS_ENABLED: 'false' }, true],
  ])('defaults on and fails closed for explicit disable configuration', (environment, expected) => {
    expect(isDailyNineComparisonReadApiEnabled(environment)).toBe(expected);
  });

  it('keeps successful responses private and non-cacheable', async () => {
    const response = dailyNineComparisonPrivateJson({
      schemaVersion: 1,
      kind: 'at-bat',
      comparison: {
        puzzleId: 'daily-id',
        puzzleDate: '2026-09-19',
        puzzleNumber: 146,
        rulesetVersion: 'points-v3',
        pitchNumber: 1,
        resolvedAtBatCount: 0,
        averagePoints: null,
      },
      freshness: {
        sourceReadAt: '2026-09-19T23:30:00.000Z',
        cacheStatus: 'live',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('fails closed with the shared unavailable shape when activation is off', async () => {
    const response = dailyNineComparisonDisabledResponse();

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'comparison_unavailable',
    });
  });

  it.each([
    [new DailyNineComparisonRequestError('invalid_request', 'hidden'), 400, 'invalid_request'],
    [new DailyNineComparisonRequestError('unsupported_ruleset', 'hidden'), 400, 'unsupported_ruleset'],
    [new DailyNineComparisonRequestError('invalid_puzzle', 'hidden'), 404, 'invalid_puzzle'],
    [new DailyRuntimeRequestError('hidden runtime detail'), 404, 'invalid_puzzle'],
  ])('maps request/authority failures without leaking messages', async (error, status, code) => {
    const response = mapDailyNineComparisonRouteError(error);

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: code,
    });
  });

  it.each([
    new ServerSupabaseConfigurationError('secret detail'),
    new SupabaseDailyNineComparisonRepositoryError('query', 'database detail'),
    new SupabaseDailyNineComparisonRepositoryError('invalid-row', 'row detail'),
  ])('maps known provider/configuration failures to sanitized 503', async (error) => {
    const response = mapDailyNineComparisonRouteError(error);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'comparison_unavailable',
    });
  });

  it('maps unexpected faults to a sanitized 500', async () => {
    const response = mapDailyNineComparisonRouteError(new Error('unexpected detail'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: 'comparison_unavailable',
    });
  });
});
