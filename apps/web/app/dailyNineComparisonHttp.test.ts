import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { DailyNineComparisonRequestError } from './dailyNineComparisonReadService';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import {
  dailyNineComparisonNoStoreJson,
  mapDailyNineComparisonRouteError,
} from './dailyNineComparisonHttp';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyNineComparisonRepositoryError } from './supabaseDailyNineComparisonRepository';

describe('Daily Nine comparison HTTP mapping', () => {
  it('marks successful comparison responses no-store until cache policy is measured', async () => {
    const response = dailyNineComparisonNoStoreJson({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it.each([
    [new DailyNineComparisonRequestError('invalid_request', 'detail'), 400, 'invalid_request'],
    [new DailyNineComparisonRequestError('invalid_puzzle', 'detail'), 400, 'invalid_puzzle'],
    [new DailyNineComparisonRequestError('unsupported_ruleset', 'detail'), 400, 'unsupported_ruleset'],
    [new DailyRuntimeRequestError('hidden puzzle detail'), 400, 'invalid_puzzle'],
    [new ServerSupabaseConfigurationError('secret detail'), 503, 'comparison_unavailable'],
    [new SupabaseDailyNineComparisonRepositoryError('query', 'database detail'), 503, 'comparison_unavailable'],
    [new SupabaseDailyNineComparisonRepositoryError('invalid-row', 'row detail'), 503, 'comparison_unavailable'],
    [new Error('unexpected internal detail'), 500, 'comparison_unavailable'],
  ])('sanitizes comparison route errors', async (error, status, code) => {
    const response = mapDailyNineComparisonRouteError(error);

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      schemaVersion: 1,
      error: code,
    });
  });
});
