import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createOfficialDailyAttemptReservationService } from './officialDailyAttemptReservation';
import { createSupabaseOfficialDailyAttemptReservationStore } from './supabaseOfficialDailyAttemptReservationStore';
vi.mock('server-only', () => ({}));

const ID = 'daily-ed-v1-11111111-1111-4111-8111-111111111111';
const KEY = 'a'.repeat(48);
const winner = {
  attempt_id: '00000000-0000-4000-8000-000000000001',
  puzzle_id: ID, puzzle_date: '2026-11-17', ruleset_version: 'points-v4',
  browser_key_digest: '', started_at: '2026-11-17T05:30:00+00:00',
  revision: 0, status: 'active',
};
function service(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ single });
  const store = createSupabaseOfficialDailyAttemptReservationStore(
    { rpc } as unknown as SupabaseClient,
  );
  const reservation = createOfficialDailyAttemptReservationService({
    now: () => new Date('2026-11-17T05:30:00Z'), store,
  });
  return { rpc, reservation };
}
describe('private Daily SQL reservation adapter', () => {
  it('binds exact ID and digest, preserving the authoritative winner on retries', async () => {
    const hash = (await import('node:crypto')).createHash('sha256').update(KEY).digest('hex');
    const { rpc, reservation } = service({ ...winner, browser_key_digest: hash });
    const request = { puzzleId: ID, puzzleDate: '2026-11-17', rulesetVersion: 'points-v4' as const, browserKey: KEY };
    const first = await reservation.reserve(request);
    expect(await reservation.reserve(request)).toEqual(first);
    expect(first.attemptId).toBe(winner.attempt_id);
    expect(rpc).toHaveBeenCalledWith('reserve_official_daily_attempt', {
      p_puzzle_id: ID, p_browser_key_digest: hash,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('fails closed on provider errors, missing or malformed SQL rows', async () => {
    const req = { puzzleId: ID, puzzleDate: '2026-11-17', rulesetVersion: 'points-v4' as const, browserKey: KEY };
    for (const [data, error] of [
      [null, { message: 'PRIVATE SQL' }], [null, null],
      [{ ...winner, revision: -1 }, null],
      [{ ...winner, ruleset_version: 'wrong' }, null],
      [{ ...winner, attempt_id: 'broken' }, null],
    ] as const) {
      const { reservation } = service(data, error);
      await expect(reservation.reserve(req)).rejects.toThrow();
    }
  });
});
