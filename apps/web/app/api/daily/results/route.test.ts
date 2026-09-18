import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { POST } from './route';

describe('POST /api/daily/results', () => {
  beforeEach(() => server.submitDailyCompletedResult.mockReset());

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
  });

  it('maps authoritative puzzle lookup failures to sanitized invalid_puzzle responses', async () => {
    const response = mapCompletedResultRouteError(
      new DailyRuntimeRequestError('hidden puzzle detail'),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'invalid_puzzle' });
  });

  it.each([
    new ServerSupabaseConfigurationError('secret missing'),
    new SupabaseDailyCompletedResultRepositoryError('query', 'database detail'),
    new SupabaseDailyCompletedResultRepositoryError('invalid-row', 'stored row detail'),
  ])('maps known provider failures to sanitized 503 responses', async (error) => {
    const response = mapCompletedResultRouteError(error);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'completed_result_unavailable' });
  });

  it('maps unexpected faults to sanitized 500 responses', async () => {
    const response = mapCompletedResultRouteError(new Error('unexpected detail'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'completed_result_unavailable' });
  });

});

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/daily/results', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
