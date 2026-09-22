import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => server.submitDailyAtBatResult.mockReset());

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
  });

  it('maps authoritative puzzle lookup failure to sanitized invalid_puzzle', async () => {
    const response = mapAtBatResultRouteError(new DailyRuntimeRequestError('hidden detail'));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'invalid_puzzle' });
  });

  it.each([
    new ServerSupabaseConfigurationError('secret missing'),
    new SupabaseDailyAtBatResultRepositoryError('query', 'database detail'),
    new SupabaseDailyAtBatResultRepositoryError('invalid-row', 'stored row detail'),
  ])('maps known provider failure to sanitized 503', async (error) => {
    const response = mapAtBatResultRouteError(error);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'at_bat_result_unavailable' });
  });

  it('maps unexpected faults to sanitized 500', async () => {
    const response = mapAtBatResultRouteError(new Error('unexpected detail'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'at_bat_result_unavailable' });
  });
});

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/daily/at-bats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
