import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const server = vi.hoisted(() => ({
  submitDailyCompletedResult: vi.fn(),
}));

vi.mock('../../../serverDailyCompletedResults', () => ({
  submitDailyCompletedResult: server.submitDailyCompletedResult,
}));

import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';
import { ServerSupabaseConfigurationError } from '../../../serverSupabaseClient';
import { SupabaseDailyCompletedResultRepositoryError } from '../../../supabaseDailyCompletedResultRepository';
import { mapCompletedResultRouteError } from '../../../dailyCompletedResultHttp';
import { DAILY_RESULT_REQUEST_BODY_MAX_BYTES } from '../../../dailyResultRequestBody';
import { POST } from './route';

describe('POST /api/daily/results', () => {
  beforeEach(() => {
    server.submitDailyCompletedResult.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{ ok: true, status: 'created' }, 201, { status: 'created' }],
    [{ ok: true, status: 'existing' }, 200, { status: 'existing' }],
    [{ ok: false, error: 'incomplete_game' }, 400, { error: 'incomplete_game' }],
    [{ ok: false, error: 'idempotency_conflict' }, 409, { error: 'idempotency_conflict' }],
  ])('maps service outcomes without exposing normalized result data', async (outcome, status, body) => {
    server.submitDailyCompletedResult.mockResolvedValue(outcome);

    const response = await POST(createRequest({ schemaVersion: 1 }));

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual(body);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before the server service', async () => {
    const response = await POST(new Request('http://localhost/api/daily/results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_submission' });
    expect(server.submitDailyCompletedResult).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies before the server service', async () => {
    const response = await POST(new Request('http://localhost/api/daily/results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('a'.repeat(DAILY_RESULT_REQUEST_BODY_MAX_BYTES)),
    }));

    expect(response.status).toBe(413);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'invalid_submission' });
    expect(server.submitDailyCompletedResult).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('maps authoritative puzzle lookup failures to sanitized invalid_puzzle responses without logging', async () => {
    const response = mapCompletedResultRouteError(
      new DailyRuntimeRequestError('hidden puzzle detail'),
    );

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
      new SupabaseDailyCompletedResultRepositoryError('query', 'database detail'),
      'provider_repository',
      'database detail',
    ],
    [
      new SupabaseDailyCompletedResultRepositoryError('invalid-row', 'stored row detail'),
      'provider_repository',
      'stored row detail',
    ],
  ])('maps known provider failures to sanitized 503 responses and safe diagnostics', async (
    error,
    category,
    sensitiveDetail,
  ) => {
    const response = mapCompletedResultRouteError(error);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'completed_result_unavailable' });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({
      event: 'daily_result_write_failure',
      route: 'completed',
      category,
      status: 503,
    }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(sensitiveDetail);
  });

  it('maps unexpected faults to sanitized 500 responses and safe diagnostics', async () => {
    const response = mapCompletedResultRouteError(new Error('unexpected detail'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'completed_result_unavailable' });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({
      event: 'daily_result_write_failure',
      route: 'completed',
      category: 'unexpected',
      status: 500,
    }));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('unexpected detail');
  });
});

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/daily/results', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
