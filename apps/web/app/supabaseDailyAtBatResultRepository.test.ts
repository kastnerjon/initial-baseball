import type { DailyAtBatResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createSupabaseDailyAtBatResultRepository } from './supabaseDailyAtBatResultRepository';

const RESULT: DailyAtBatResult = {
  schemaVersion: 1,
  attemptId: 'attempt-1',
  puzzleId: 'daily-2026-09-18-editorial-v1',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: 'points-v3',
  atBat: {
    pitchNumber: 7,
    initials: 'RH',
    outcome: '3B',
    hintsRevealed: 1,
    wrongGuesses: 1,
    resolution: 'correct',
  },
  awardedPoints: 5,
};

describe('Supabase resolved-at-bat repository', () => {
  it('inserts every normalized field without an update or upsert path', async () => {
    const single = vi.fn().mockResolvedValue({ data: toRow(RESULT), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const stored = await createSupabaseDailyAtBatResultRepository(asClient(from))
      .insertIfAbsent(RESULT);

    expect(stored).toEqual({ status: 'inserted', result: RESULT });
    expect(from).toHaveBeenCalledWith('daily_at_bat_results');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(toRow(RESULT));
  });

  it('reads the existing winner by the complete observation key after a unique conflict', async () => {
    const insert = uniqueConflictInsert();
    const maybeSingle = vi.fn().mockResolvedValue({ data: toRow(RESULT), error: null });
    const eq = vi.fn();
    const query = { eq, maybeSingle };
    eq.mockReturnValue(query);
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue(query) });

    const stored = await createSupabaseDailyAtBatResultRepository(asClient(from))
      .insertIfAbsent(RESULT);

    expect(stored).toEqual({ status: 'existing', result: RESULT });
    expect(eq.mock.calls).toEqual([
      ['attempt_id', RESULT.attemptId],
      ['puzzle_id', RESULT.puzzleId],
      ['ruleset_version', RESULT.rulesetVersion],
      ['pitch_number', RESULT.atBat.pitchNumber],
    ]);
  });

  it('fails closed if the existing winner is malformed', async () => {
    const malformed = { ...toRow(RESULT), awarded_points: '5' };
    const from = vi.fn()
      .mockReturnValueOnce({ insert: uniqueConflictInsert() })
      .mockReturnValueOnce(readQuery({ data: malformed, error: null }));

    await expect(
      createSupabaseDailyAtBatResultRepository(asClient(from)).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('maps non-unique insert failures to a query error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });

    await expect(
      createSupabaseDailyAtBatResultRepository(
        asClient(vi.fn().mockReturnValue({ insert })),
      ).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({ kind: 'query', message: expect.stringContaining('connection failure') });
  });

  it('maps a failed conflict read to a query error', async () => {
    const from = vi.fn()
      .mockReturnValueOnce({ insert: uniqueConflictInsert() })
      .mockReturnValueOnce(readQuery({ data: null, error: { message: 'read failure' } }));

    await expect(
      createSupabaseDailyAtBatResultRepository(asClient(from)).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({ kind: 'query', message: expect.stringContaining('read failure') });
  });

  it('treats a unique conflict with no readable winner as a provider invariant failure', async () => {
    const from = vi.fn()
      .mockReturnValueOnce({ insert: uniqueConflictInsert() })
      .mockReturnValueOnce(readQuery({ data: null, error: null }));

    await expect(
      createSupabaseDailyAtBatResultRepository(asClient(from)).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({ kind: 'query', message: expect.stringContaining('could not be read') });
  });
});

function uniqueConflictInsert() {
  const single = vi.fn().mockResolvedValue({
    data: null,
    error: { code: '23505', message: 'duplicate key value' },
  });
  return vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
}

function readQuery(result: { data: unknown; error: unknown }) {
  const query: { eq: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> } = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.eq.mockReturnValue(query);
  return { select: vi.fn().mockReturnValue(query) };
}

function toRow(result: DailyAtBatResult): Record<string, unknown> {
  return {
    attempt_id: result.attemptId,
    schema_version: result.schemaVersion,
    puzzle_id: result.puzzleId,
    puzzle_date: result.puzzleDate,
    puzzle_number: result.puzzleNumber,
    ruleset_version: result.rulesetVersion,
    pitch_number: result.atBat.pitchNumber,
    initials: result.atBat.initials,
    outcome: result.atBat.outcome,
    hints_revealed: result.atBat.hintsRevealed,
    wrong_guesses: result.atBat.wrongGuesses,
    resolution: result.atBat.resolution,
    awarded_points: result.awardedPoints,
  };
}

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
