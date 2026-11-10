import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../dailyAdminAuthorization', () => {
  class DailyAdminAuthorizationError extends Error {
    constructor(readonly kind: string) { super('PRIVATE_ADMIN_DETAILS'); }
  }
  return {
    DailyAdminAuthorizationError,
    DAILY_ADMIN_AUTH_CHALLENGE: 'Basic realm="Daily Admin"',
    requireDailyAdminPrincipal: vi.fn(),
  };
});
vi.mock('../../../../dailyAdminRequestSecurity', () => ({
  isSameOriginDailyAdminMutation: vi.fn(() => true),
}));
vi.mock('../../../../dailyChatOpsAuthorization', () => ({
  DailyChatOpsAuthorizationError: class extends Error {},
  requireDailyChatOpsPrincipal: vi.fn(),
}));
vi.mock('../../../../serverArchiveBetaRollover', () => ({
  runArchiveBetaRollover: vi.fn(),
}));

import { POST } from './route';
import { isSameOriginDailyAdminMutation } from '../../../../dailyAdminRequestSecurity';
import { requireDailyAdminPrincipal } from '../../../../dailyAdminAuthorization';
import { runArchiveBetaRollover } from '../../../../serverArchiveBetaRollover';

const request = () => new Request('https://initial.test/admin/daily/archive-beta/rollover', {
  method: 'POST', headers: { authorization: 'Basic test', origin: 'https://initial.test' },
});
const success = {
  cutoffDate: '2026-11-08', created: 0, preserved: 34, remaining: 0,
  failures: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.mocked(runArchiveBetaRollover).mockResolvedValue(success);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('archive beta rollover operational error metadata', () => {
  it('never starts rollover for a cross-site mutation', async () => {
    vi.mocked(isSameOriginDailyAdminMutation).mockReturnValueOnce(false);
    expect((await POST(request())).status).toBe(403);
    expect(runArchiveBetaRollover).not.toHaveBeenCalled();
  });

  it('preserves successful response and avoids failure logging', async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(requireDailyAdminPrincipal).toHaveBeenCalledOnce();
    expect(await result.json()).toEqual(success);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('reports sanitized missing source, immutable conflict and unavailable counts without changing 503', async () => {
    vi.mocked(runArchiveBetaRollover).mockResolvedValueOnce({
      ...success, failures: [
        { puzzleDate: '2026-10-16', kind: 'missing-source' },
        { puzzleDate: '2026-11-01', kind: 'unavailable' },
        { puzzleDate: '2026-11-02', kind: 'immutable-conflict' },
      ],
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(console.error).toHaveBeenCalledOnce();
    const diagnostic = JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string);
    expect(diagnostic).toEqual({
      event: 'archive-rollover-incomplete', failed: 3, remaining: 0,
      failureKinds: { 'missing-source': 1, 'immutable-conflict': 1, unavailable: 1 },
      sampleFailures: [
        { puzzleDate: '2026-10-16', kind: 'missing-source' },
        { puzzleDate: '2026-11-01', kind: 'unavailable' },
        { puzzleDate: '2026-11-02', kind: 'immutable-conflict' },
      ],
      omittedFailures: 0,
    });
    expect(JSON.stringify(diagnostic)).not.toContain('PRIVATE_ADMIN_DETAILS');
  });

  it('bounds logged failure samples while retaining all failure counts', async () => {
    vi.mocked(runArchiveBetaRollover).mockResolvedValueOnce({
      ...success, remaining: 4,
      failures: Array.from({ length: 9 }, (_, i) => ({
        puzzleDate: new Date(Date.UTC(2026, 9, 16 + i)).toISOString().slice(0, 10),
        kind: 'missing-source' as const,
      })),
    });
    expect((await POST(request())).status).toBe(503);
    const diagnostic = JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string);
    expect(diagnostic.failureKinds).toEqual({
      'missing-source': 9, 'immutable-conflict': 0, unavailable: 0,
    });
    expect(diagnostic.sampleFailures).toHaveLength(5);
    expect(diagnostic.omittedFailures).toBe(4);
    expect(diagnostic.remaining).toBe(4);
  });

  it('retains 503 with remaining work even when no dates failed', async () => {
    vi.mocked(runArchiveBetaRollover).mockResolvedValueOnce({ ...success, remaining: 2 });
    expect((await POST(request())).status).toBe(503);
    const diagnostic = JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string);
    expect(diagnostic.failed).toBe(0);
    expect(diagnostic.remaining).toBe(2);
    expect(diagnostic.sampleFailures).toEqual([]);
  });
});
