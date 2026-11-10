import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const run = vi.hoisted(() => vi.fn());
vi.mock('./serverArchiveBetaRollover', () => ({ runArchiveBetaRollover: run }));
import { POST } from './admin/daily/archive-beta/rollover/route';

const secret = 'test-only-archive-rollover-secret-0123456789';
const url = 'https://game.test/admin/daily/archive-beta/rollover';
const result = { cutoffDate: '2026-10-07', created: 2, preserved: 1, remaining: 0, failures: [] };
describe('archive rollover request boundaries', () => {
  beforeEach(() => {
    vi.stubEnv('DAILY_CHATOPS_TOKEN', secret);
    vi.stubEnv('DAILY_ADMIN_USERNAME', 'editor');
    vi.stubEnv('DAILY_ADMIN_PASSWORD', secret);
    run.mockReset().mockResolvedValue(result);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  it('rejects absent, wrong and lookalike authorization before any I/O', async () => {
    for (const authorization of ['', 'Bearer undefined', `Bearer ${secret}x`, `Basic ${secret}`]) {
      const response = await POST(new Request(url, { method: 'POST', headers: { authorization } }));
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(run).not.toHaveBeenCalled();
  });
  it.each(['', 'short'])('fails closed for misconfigured secret %s', async configured => {
    vi.stubEnv('DAILY_CHATOPS_TOKEN', configured);
    expect((await POST(new Request(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }))).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });
  it('returns metadata only after authenticated rollover', async () => {
    const response = await POST(new Request(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(run).toHaveBeenCalledOnce();
  });
  it('reports partial failures and pending work as retryable without private error payloads', async () => {
    for (const incomplete of [{ ...result, failures: [{ puzzleDate: '2026-10-05', kind: 'unavailable' }] }, { ...result, remaining: 1 }]) {
      run.mockResolvedValueOnce(incomplete);
      expect((await POST(new Request(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }))).status).toBe(503);
    }
    run.mockRejectedValueOnce(new Error('hidden answer / private key'));
    const response = await POST(new Request(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Archive rollover is temporarily unavailable.' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private key');
  });
  it('requires same-origin and existing Basic administrator credentials for manual recovery', async () => {
    const adminUrl = 'https://game.test/admin/daily/archive-beta/rollover';
    const authorization = `Basic ${Buffer.from(`editor:${secret}`).toString('base64')}`;
    expect((await POST(new Request(adminUrl, { method: 'POST', headers: { authorization, origin: 'https://other.test' } }))).status).toBe(403);
    const anonymous = await POST(new Request(adminUrl, { method: 'POST' }));
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('www-authenticate')).toContain('Basic');
    expect(run).not.toHaveBeenCalled();
    const response = await POST(new Request(adminUrl, { method: 'POST', headers: { authorization, origin: 'https://game.test' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(run).toHaveBeenCalledOnce();
  });
  it('records bounded per-kind rollover failure evidence without private payloads', async () => {
    const failures = [
      { puzzleDate: '2026-10-16', kind: 'missing-source', sourceSelections: 'fixture-private-player-id', clueSnapshot: 'fixture-unreleased-hint' },
      { puzzleDate: '2026-11-01', kind: 'unavailable' },
      { puzzleDate: '2026-11-02', kind: 'immutable-conflict' },
      { puzzleDate: '2026-11-03', kind: 'missing-source' },
      { puzzleDate: '2026-11-04', kind: 'unavailable' },
      { puzzleDate: '2026-11-05', kind: 'unavailable' },
      { puzzleDate: '2026-11-06', kind: 'immutable-conflict' },
    ];
    run.mockResolvedValueOnce({ ...result, remaining: 2, failures });
    const response = await POST(new Request(url, {
      method: 'POST', headers: { authorization: 'Bearer ' + secret },
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ ...result, remaining: 2, failures });
    expect(console.error).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));
    expect(logged).toEqual({
      event: 'archive-rollover-incomplete',
      failed: 7,
      remaining: 2,
      failureKinds: { 'missing-source': 2, 'immutable-conflict': 2, unavailable: 3 },
      sampleFailures: failures.slice(0, 5).map(({ puzzleDate, kind }) => ({ puzzleDate, kind })),
      omittedFailures: 2,
    });
    const message = JSON.stringify(logged);
    expect(message).not.toContain('2026-11-05');
    expect(message).not.toContain('2026-11-06');
    expect(message).not.toContain('sourceSelections');
    expect(message).not.toContain('clueSnapshot');
    expect(message).not.toContain('fixture-private-player-id');
    expect(message).not.toContain('fixture-unreleased-hint');
  });

  it('distinguishes backlog-only alerts from completed rollovers', async () => {
    run.mockResolvedValueOnce({ ...result, remaining: 3 });
    expect((await POST(new Request(url, {
      method: 'POST', headers: { authorization: 'Bearer ' + secret },
    }))).status).toBe(503);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]))).toEqual({
      event: 'archive-rollover-incomplete',
      failed: 0,
      remaining: 3,
      failureKinds: { 'missing-source': 0, 'immutable-conflict': 0, unavailable: 0 },
      sampleFailures: [],
      omittedFailures: 0,
    });
    vi.mocked(console.error).mockClear();
    expect((await POST(new Request(url, {
      method: 'POST', headers: { authorization: 'Bearer ' + secret },
    }))).status).toBe(200);
    expect(console.error).not.toHaveBeenCalled();
  });

});
