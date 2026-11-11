import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const run = vi.hoisted(() => vi.fn());
vi.mock('./serverArchiveBetaRollover', () => ({ runArchiveBetaRollover: run }));
import { POST } from './admin/daily/archive-beta/rollover/route';

const secret = 'test-only-archive-rollover-secret-0123456789';
const url = 'https://game.test/admin/daily/archive-beta/rollover';
const headers = { authorization: 'Bearer ' + secret };

beforeEach(() => {
  vi.stubEnv('DAILY_CHATOPS_TOKEN', secret);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  run.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('archive rollover response privacy projection', () => {
  it.each([
    { remaining: 0, failures: [], expectedStatus: 200 },
    { remaining: 1, failures: [{ puzzleDate: '2026-10-16', kind: 'missing-source' }],
      expectedStatus: 503 },
  ])('returns only public metadata after a privileged rollover (status $expectedStatus)', async ({
    remaining, failures, expectedStatus,
  }) => {
    run.mockResolvedValueOnce({
      cutoffDate: '2026-11-10', created: 2, preserved: 3, remaining,
      failures: failures.map(failure => ({
        ...failure, sourceSelections: 'PRIVATE_PLAYER_SELECTION',
        clueSnapshot: { answer: 'PRIVATE_HIDDEN_ANSWER' },
      })),
      internalSql: 'PRIVATE_SQL',
      unpublishedRoster: ['PRIVATE_ROSTER'],
    });
    const response = await POST(new Request(url, { method: 'POST', headers }));
    expect(response.status).toBe(expectedStatus);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body).toEqual({
      cutoffDate: '2026-11-10', created: 2, preserved: 3, remaining, failures,
    });
    const text = JSON.stringify(body);
    for (const forbidden of [
      'PRIVATE_PLAYER_SELECTION', 'PRIVATE_HIDDEN_ANSWER', 'PRIVATE_SQL',
      'PRIVATE_ROSTER', 'sourceSelections', 'clueSnapshot', 'unpublishedRoster',
    ]) expect(text).not.toContain(forbidden);
    expect(run).toHaveBeenCalledOnce();
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).not.toContain('PRIVATE_HIDDEN_ANSWER');
    expect(logs).not.toContain('PRIVATE_PLAYER_SELECTION');
  });
});