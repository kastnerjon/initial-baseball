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
  it('fails closed on provider errors and independently malformed SQL fields', async () => {
    const hash = (await import('node:crypto')).createHash('sha256').update(KEY).digest('hex');
    const valid = { ...winner, browser_key_digest: hash };
    const req = { puzzleId: ID, puzzleDate: '2026-11-17', rulesetVersion: 'points-v4' as const, browserKey: KEY };
    // Positive control ensures no rejection is caused by the baseline mock.
    await expect(service(valid).reservation.reserve(req)).resolves.toMatchObject({
      attemptId: winner.attempt_id, puzzleId: ID, browserKeyDigest: hash,
    });
    for (const [data, error] of [
      [null, { message: 'PRIVATE SQL' }], [null, null],
      [{ ...valid, revision: -1 }, null],
      [{ ...valid, revision: 0.5 }, null],
      [{ ...valid, ruleset_version: 'wrong' }, null],
      [{ ...valid, attempt_id: 'broken' }, null],
      [{ ...valid, status: 'pending' }, null],
      [{ ...valid, started_at: null }, null],
      [{ ...valid, puzzle_id: 'daily-ed-v1-22222222-2222-4222-8222-222222222222' }, null],
      [{ ...valid, browser_key_digest: 'b'.repeat(64) }, null],
      [{ ...valid, puzzle_date: '2026-11-16' }, null],
    ] as const) {
      const { reservation } = service(data, error);
      await expect(reservation.reserve(req)).rejects.toThrow();
    }
  });
});
