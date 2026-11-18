import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import { createSupabaseOfficialDailyAtomicCompletionStore } from './supabaseOfficialDailyAtomicCompletionStore';
vi.mock('server-only', () => ({}));

const reservation = {
  puzzleId: 'daily-ed-v1-11111111-1111-4111-8111-111111111111',
  puzzleDate: '2026-11-17', rulesetVersion: 'points-v4' as const,
  attemptId: '00000000-0000-4000-8000-000000000001',
  browserKeyDigest: 'a'.repeat(64), startedAt: '2026-11-17T17:00:00.000Z',
};
const facts = Array.from({ length: 9 }, (_, i) => ({
  pitchNumber: i + 1, initials: 'HP', outcome: 'K' as const,
  hintsRevealed: 1 as const, wrongGuesses: 0, resolution: 'give_up' as const,
}));
const atBats = facts.map(atBat => ({
  schemaVersion: 1, attemptId: reservation.attemptId, puzzleId: reservation.puzzleId,
  puzzleDate: reservation.puzzleDate, puzzleNumber: 1,
  rulesetVersion: 'points-v4', atBat, awardedPoints: 0,
})) as DailyAtBatResult[];
const completion = {
  schemaVersion: 1,
  submissionId: `official-${reservation.puzzleId}-${reservation.attemptId}`,
  puzzleId: reservation.puzzleId, puzzleDate: reservation.puzzleDate,
  puzzleNumber: 1, rulesetVersion: 'points-v4',
  completedAtBats: facts,
  summary: { points: 0, maximumPoints: 36, atBatsCompleted: 9,
    totalAtBats: 9, completed: true, strikeouts: 9 },
} as DailyCompletedResult;
const input = { reservation, canonicalToken: 'official-daily-competitive-proof-v1.token.sig',
  atBats, completion };

function mock(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc, store: createSupabaseOfficialDailyAtomicCompletionStore(
    { rpc } as unknown as SupabaseClient,
  ) };
}

describe('private atomic official Daily completion adapter', () => {
  it('sends one RPC containing exactly nine ordered normalized rows and one completion', async () => {
    const { rpc, store } = mock('created');
    await expect(store.commit(input)).resolves.toBe('created');
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('commit_official_daily_completed_results');
    expect(args).toMatchObject({
      p_puzzle_id: reservation.puzzleId,
      p_browser_key_digest: reservation.browserKeyDigest,
      p_attempt_id: reservation.attemptId,
      p_expected_token: input.canonicalToken,
    });
    expect(args.p_at_bat_rows).toHaveLength(9);
    expect((args.p_at_bat_rows as Record<string, unknown>[])[8]).toMatchObject({
      pitch_number: 9, awarded_points: 0, puzzle_id: reservation.puzzleId,
    });
    expect(args.p_completion_row).toMatchObject({
      submission_id: completion.submissionId, puzzle_id: reservation.puzzleId,
      ruleset_version: 'points-v4',
    });
  });

  it('accepts idempotent SQL replay but rejects ambiguous provider responses', async () => {
    await expect(mock('existing').store.commit(input)).resolves.toBe('existing');
    for (const value of [null, 'conflict', 'advanced', 1]) {
      await expect(mock(value).store.commit(input)).rejects.toThrow(
        'Private official Daily completion unavailable.',
      );
    }
    await expect(mock(null, { message: 'secret SQL detail' }).store.commit(input))
      .rejects.toThrow('Private official Daily completion unavailable.');
  });

  it('rejects swapped editions, wrong attempts, partial and reordered facts before RPC', async () => {
    const bad = [
      { ...input, atBats: atBats.slice(0, 8) },
      { ...input, reservation: { ...reservation, puzzleId:
        'daily-ed-v1-22222222-2222-4222-8222-222222222222' } },
      { ...input, atBats: [...atBats].reverse() },
      { ...input, atBats: atBats.map((row, i) => i === 0
        ? { ...row, attemptId: '00000000-0000-4000-8000-000000000002' } : row) },
      { ...input, canonicalToken: 'unsigned' },
      { ...input, completion: { ...completion, submissionId: 'other' } },
    ];
    const { rpc, store } = mock('created');
    for (const candidate of bad) {
      await expect(store.commit(candidate)).rejects.toThrow(
        'Invalid private official Daily completion input.',
      );
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
