import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyRuntimeRequestError } from '../../../dailyRuntimeService';

const server = vi.hoisted(() => ({
  submitDailyCompletedResult: vi.fn(),
}));

vi.mock('../../../serverDailyCompletedResults', () => ({
  submitDailyCompletedResult: server.submitDailyCompletedResult,
}));

import { POST } from './route';

describe('POST /api/daily/results', () => {
  beforeEach(() => {
    server.submitDailyCompletedResult.mockReset();
  });

  it('returns 201 for a first insert and keeps the response private', async () => {
    server.submitDailyCompletedResult.mockResolvedValue({ ok: true, status: 'created' });

    const response = await POST(createRequest({ submissionId: 'new-id' }));

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ status: 'created' });
  });

  it('returns 200 for an idempotent retry', async () => {
    server.submitDailyCompletedResult.mockResolvedValue({ ok: true, status: 'existing' });

    const response = await POST(createRequest({ submissionId: 'existing-id' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'existing' });
  });

  it('maps validation rejection to 400 and idempotency conflict to 409', async () => {
    server.submitDailyCompletedResult.mockResolvedValueOnce({
      ok: false,
      error: 'incomplete_game',
    });
    server.submitDailyCompletedResult.mockResolvedValueOnce({
      ok: false,
      error: 'idempotency_conflict',
    });

    const invalid = await POST(createRequest({}));
    const conflict = await POST(createRequest({}));

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: 'incomplete_game' });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ error: 'idempotency_conflict' });
  });

  it('rejects malformed JSON without touching the server service', async () => {
    const request = new Request('http://localhost/api/daily/results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_submission' });
    expect(server.submitDailyCompletedResult).not.toHaveBeenCalled();
  });

  it('sanitizes authoritative puzzle lookup failures', async () => {
    server.submitDailyCompletedResult.mockRejectedValue(
      new DailyRuntimeRequestError('hidden provider/puzzle detail'),
    );

    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_puzzle' });
  });

  it('sanitizes unexpected provider/configuration failures', async () => {
    server.submitDailyCompletedResult.mockRejectedValue(new Error('service-role key missing'));

    const response = await POST(createRequest({}));

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
