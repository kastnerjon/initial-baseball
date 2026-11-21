import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseOfficialDailyProgressionStore } from './supabaseOfficialDailyProgressionStore';
vi.mock('server-only', () => ({}));

const reservation = {
  puzzleId: 'daily-ed-v1-11111111-1111-4111-8111-111111111111',
  puzzleDate: '2026-11-17', rulesetVersion: 'points-v4' as const,
  attemptId: '00000000-0000-4000-8000-000000000001',
  browserKeyDigest: 'a'.repeat(64), startedAt: '2026-11-17T17:00:00.000Z',
};
const FIRST = 'official-daily-competitive-proof-v1.first.sig';
const NEXT = 'official-daily-competitive-proof-v1.second.sig';
const FACT = { pitchNumber: 1, initials: 'HP', outcome: 'K' as const,
  hintsRevealed: 1 as const, wrongGuesses: 0, resolution: 'give_up' as const };
const valid = {
  outcome: 'initialized', attempt_id: reservation.attemptId,
  puzzle_id: reservation.puzzleId, browser_key_digest: reservation.browserKeyDigest,
  started_at: reservation.startedAt, revision: 0, current_progression_token: FIRST,
  terminal_at_bats: [], status: 'active',
};
function mock(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ single });
  const store = createSupabaseOfficialDailyProgressionStore({ rpc } as unknown as SupabaseClient);
  return { rpc, store };
}

describe('private official Daily monotonic SQL progression adapter', () => {
  it('reads the exact reserved current winner through service-only SQL and validates its fields', async () => {
    const row = { ...valid, outcome: undefined };
    function readMock(data: unknown, error: unknown = null) {
      const single = vi.fn().mockResolvedValue({ data, error });
      const q = { select: vi.fn(), eq: vi.fn(), single };
      q.select.mockReturnValue(q);
      q.eq.mockReturnValue(q);
      const from = vi.fn().mockReturnValue(q);
      const store = createSupabaseOfficialDailyProgressionStore(
        { from } as unknown as SupabaseClient,
      );
      return { store, from, q };
    }
    const { store, from, q } = readMock(row);
    await expect(store.read(reservation)).resolves.toEqual({
      token: FIRST, revision: 0, terminalAtBats: [], status: 'active',
    });
    expect(from).toHaveBeenCalledWith('official_daily_attempt_states');
    expect(q.eq).toHaveBeenCalledWith('puzzle_id', reservation.puzzleId);
    expect(q.eq).toHaveBeenCalledWith('browser_key_digest', reservation.browserKeyDigest);
    expect(q.eq).toHaveBeenCalledWith('attempt_id', reservation.attemptId);
    for (const invalid of [
      null, { ...row, attempt_id: 'bad' },
      { ...row, browser_key_digest: 'b'.repeat(64) },
      { ...row, started_at: '2026-11-17T18:00:00.000Z' },
      { ...row, current_progression_token: 'malformed' },
      { ...row, terminal_at_bats: [{ ...FACT, pitchNumber: 2 }] },
    ]) {
      await expect(readMock(invalid).store.read(reservation)).rejects.toThrow();
    }
    await expect(readMock(null, { message: 'secret provider details' }).store.read(reservation))
      .rejects.toThrow('Private official Daily progression unavailable.');
  });

  it('initializes an exact reservation and does not replace the existing winning token', async () => {
    const { rpc, store } = mock(valid);
    await expect(store.initialize(reservation, FIRST)).resolves.toMatchObject({
      outcome: 'initialized', state: { token: FIRST, revision: 0, status: 'active' },
    });
    expect(rpc).toHaveBeenCalledWith('initialize_official_daily_progression', {
      p_puzzle_id: reservation.puzzleId,
      p_browser_key_digest: reservation.browserKeyDigest,
      p_attempt_id: reservation.attemptId, p_initial_token: FIRST,
    });
    const existing = mock({ ...valid, outcome: 'existing' });
    await expect(existing.store.initialize(reservation, NEXT)).resolves.toMatchObject({
      outcome: 'existing', state: { token: FIRST },
    });
  });

  it('returns atomic advance, duplicate retry and conflicting fork outcomes without confusing them', async () => {
    const input = { reservation, expectedToken: FIRST, nextToken: NEXT,
      terminalAtBats: [FACT], completed: false };
    const advanced = { ...valid, outcome: 'advanced',
      revision: 1, current_progression_token: NEXT,
      // PostgreSQL jsonb may reorder object keys; comparison is field-based.
      terminal_at_bats: [{ resolution: FACT.resolution, wrongGuesses: FACT.wrongGuesses,
        hintsRevealed: FACT.hintsRevealed, outcome: FACT.outcome,
        initials: FACT.initials, pitchNumber: FACT.pitchNumber }] };
    const { rpc, store } = mock(advanced);
    await expect(store.advance(input)).resolves.toMatchObject({
      outcome: 'advanced', state: { token: NEXT, revision: 1, terminalAtBats: [FACT] },
    });
    expect(rpc).toHaveBeenCalledWith('advance_official_daily_progression', {
      p_puzzle_id: reservation.puzzleId,
      p_browser_key_digest: reservation.browserKeyDigest,
      p_attempt_id: reservation.attemptId,
      p_expected_token: FIRST, p_next_token: NEXT,
      p_terminal_at_bats: [FACT], p_completed: false,
    });
    await expect(mock({ ...advanced, outcome: 'existing' }).store.advance(input))
      .resolves.toMatchObject({ outcome: 'existing', state: { token: NEXT } });
    await expect(mock({ ...advanced, outcome: 'conflict' }).store.advance(input))
      .resolves.toMatchObject({ outcome: 'conflict', state: { token: NEXT } });
  });

  it('fails closed for provider errors and each independently malformed identity or authority field', async () => {
    await expect(mock(valid).store.initialize(reservation, FIRST)).resolves.toBeDefined();
    const invalid = [
      null, { ...valid, attempt_id: 'wrong' },
      { ...valid, puzzle_id: 'daily-ed-v1-22222222-2222-4222-8222-222222222222' },
      { ...valid, browser_key_digest: 'b'.repeat(64) },
      { ...valid, started_at: '2026-11-17T17:01:00Z' },
      { ...valid, revision: -1 }, { ...valid, revision: 1.5 },
      { ...valid, current_progression_token: 'not-signed' },
      { ...valid, current_progression_token: null },
      { ...valid, terminal_at_bats: null },
      { ...valid, status: 'completed' }, { ...valid, outcome: 'invented' },
    ];
    for (const row of invalid) {
      await expect(mock(row).store.initialize(reservation, FIRST)).rejects.toThrow(
        'Private official Daily progression',
      );
    }
    await expect(mock(null, { message: 'PRIVATE SQL ERRORS' }).store.initialize(reservation, FIRST))
      .rejects.toThrow('Private official Daily progression unavailable.');
    const damaged = { ...valid, outcome: 'advanced',
      revision: 1, current_progression_token: NEXT, terminal_at_bats: [FACT] };
    await expect(mock(damaged).store.advance({ reservation, expectedToken: FIRST,
      nextToken: NEXT, terminalAtBats: [], completed: false }))
      .rejects.toThrow('Private official Daily progression invalid.');
  });
});
