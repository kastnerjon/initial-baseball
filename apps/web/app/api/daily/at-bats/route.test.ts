import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const server = vi.hoisted(() => ({ submitDailyAtBatResult: vi.fn() }));

vi.mock('../../../serverDailyAtBatResults', () => ({
  submitDailyAtBatResult: server.submitDailyAtBatResult,
}));

import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { ServerSupabaseConfigurationError } from '../../../serverSupabaseClient';
import { SupabaseDailyAtBatResultRepositoryError } from '../../../supabaseDailyAtBatResultRepository';
import { mapAtBatResultRouteError } from '../../../dailyAtBatResultHttp';
import { DAILY_RESULT_REQUEST_BODY_MAX_BYTES } from '../../../dailyResultRequestBody';
import { POST } from './route';

describe('POST /api/daily/at-bats', () => {
  beforeEach(() => {
    server.submitDailyAtBatResult.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{ ok: true, status: 'created' }, 201, { status: 'created' }],
    [{ ok: true, status: 'existing' }, 200, { status: 'existing' }],
    [{ ok: false, error: 'puzzle_mismatch' }, 400, { error: 'puzzle_mismatch' }],
    [{ ok: false, error: 'idempotency_conflict' }, 409, { error: 'idempotency_conflict' }],
  ])('maps service outcomes without exposing normalized observation data', async (outcome, status, body) => {
    server.submitDailyAtBatResult.mockResolvedValue(outcome);

    const response = await POST(createRequest({ schemaVersion: 1 }));

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual(body);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before server composition', async () => {
    const response = await POST(new Request('http://localhost/api/daily/at-bats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_submission' });
    expect(server.submitDailyAtBatResult).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies before server composition', async () => {
    const response = await POST(new Request('http://localhost/api/daily/at-bats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('a'.repeat(DAILY_RESULT_REQUEST_BODY_MAX_BYTES)),
    }));

    expect(response.status).toBe(413);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'invalid_submission' });
    expect(server.submitDailyAtBatResult).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('maps authoritative puzzle lookup failure to sanitized invalid_puzzle without logging it', async () => {
    const response = mapAtBatResultRouteError(new DailyRuntimeRequestError('hidden detail'));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'invalid_puzzle' });
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    [
      new ServerSupabaseConfigurationError('secret missing'),
      'provider_configuration',
      'secret missing',
    ],
    [
      new SupabaseDailyAtBatResultRepositoryError('query', 'database detail'),
      'provider_repository',
      'database detail',
    ],
    [
      new SupabaseDailyAtBatResultRepositoryError('invalid-row', 'stored row detail'),
      'provider_repository',
      'stored row detail',
    ],
  ])('maps known provider failure to sanitized 503 and safe diagnostics', async (
    error,
    category,
    sensitiveDetail,
  ) => {
    const response = mapAtBatResultRouteError(error);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'at_bat_result_unavailable' });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({
      event: 'daily_result_write_failure',
      route: 'at_bat',
      category,
      status: 503,
    }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(sensitiveDetail);
  });

  it('maps unexpected faults to sanitized 500 and safe diagnostics', async () => {
    const response = mapAtBatResultRouteError(new Error('unexpected detail'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'at_bat_result_unavailable' });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({
      event: 'daily_result_write_failure',
      route: 'at_bat',
      category: 'unexpected',
      status: 500,
    }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('unexpected detail');
  });
});

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/daily/at-bats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
