import { describe, expect, it, vi } from 'vitest';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

import {
  encodeCustomNineAtBatRow, decodeCustomNineAtBatRow,
  encodeCustomNineCompletedRow, decodeCustomNineCompletedRow,
} from './customNineResultRowCodec';
import {
  createSupabaseCustomNineAtBatResultRepository,
  createSupabaseCustomNineCompletedResultRepository,
} from './supabaseCustomNineResultRepositories';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const COMPLETION: DailyCompletedResult = {
  schemaVersion: 1, submissionId: 'submission_1', puzzleId: ID,
  puzzleDate: '1970-01-01', puzzleNumber: 1, rulesetVersion: 'points-v4',
  completedAtBats: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1, initials: 'BH', outcome: 'HR' as const,
    hintsRevealed: 0 as const, wrongGuesses: 0, resolution: 'correct' as const,
  })),
  summary: {
    points: 36, maximumPoints: 36, atBatsCompleted: 9,
    totalAtBats: 9, completed: true, strikeouts: 0,
  },
};
const AT_BAT: DailyAtBatResult = {
  schemaVersion: 1, attemptId: 'attempt_1', puzzleId: ID,
  puzzleDate: '1970-01-01', puzzleNumber: 1, rulesetVersion: 'points-v4',
  atBat: {
    pitchNumber: 3, initials: 'BH', outcome: 'BB', hintsRevealed: 4,
    wrongGuesses: 2, resolution: 'correct',
  },
  awardedPoints: 0.5,
};

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
function dbInsert(data: unknown, error: unknown = null) {
  return vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data, error }) }),
  });
}
function dbRead(data: unknown, error: unknown = null) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  query.eq.mockReturnValue(query);
  return { select: vi.fn().mockReturnValue(query), eq: query.eq };
}

describe('private Custom Nine result row codecs', () => {
  it('round trips a completed nine-batter score without storing a fake daily date or number', () => {
    const row = encodeCustomNineCompletedRow(COMPLETION);
    expect(row).toMatchObject({ challenge_id: ID, ruleset_version: 'points-v4', schema_version: 1 });
    expect(row).not.toHaveProperty('puzzle_date');
    expect(row).not.toHaveProperty('puzzle_number');
    expect(row).not.toHaveProperty('puzzle_id');
    expect(decodeCustomNineCompletedRow(row)).toEqual(COMPLETION);
  });

  it('round trips a half-point terminal at-bat with no calendar columns', () => {
    const row = encodeCustomNineAtBatRow(AT_BAT);
    expect(row).toMatchObject({ challenge_id: ID, awarded_points: 0.5 });
    expect(row).not.toHaveProperty('puzzle_date');
    expect(row).not.toHaveProperty('puzzle_number');
    expect(decodeCustomNineAtBatRow(row)).toEqual(AT_BAT);
  });

  it.each([
    { ...COMPLETION, puzzleId: 'daily-2026-10-09-editorial-v1' },
    { ...COMPLETION, puzzleDate: '2026-10-09' },
    { ...COMPLETION, puzzleNumber: 8 },
    { ...COMPLETION, rulesetVersion: 'points-v3' as const },
    { ...COMPLETION, completedAtBats: COMPLETION.completedAtBats.slice(0, 8) },
    { ...COMPLETION, completedAtBats: [...COMPLETION.completedAtBats].reverse() },
    { ...COMPLETION, summary: { ...COMPLETION.summary, completed: false } },
  ])('rejects off-domain or incomplete completions before storage', input => {
    expect(() => encodeCustomNineCompletedRow(input as DailyCompletedResult))
      .toThrow();
  });

  it('normalizes corrupt input into the Custom invalid-row error before any provider call', async () => {
    const malformed = [
      { ...COMPLETION, completedAtBats: null },
      { ...COMPLETION, summary: { points: '36', completed: true } },
      { ...COMPLETION, completedAtBats: [{ pitchNumber: 1 }] },
    ];
    for (const item of malformed) {
      expect(() => encodeCustomNineCompletedRow(item as unknown as DailyCompletedResult))
        .toThrow(expect.objectContaining({ kind: 'invalid-row' }));
    }
    const from = vi.fn();
    const repository = createSupabaseCustomNineCompletedResultRepository(asClient(from));
    for (const item of malformed) {
      await expect(repository.insertIfAbsent(item as unknown as DailyCompletedResult))
        .rejects.toMatchObject({ kind: 'invalid-row' });
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects bad at-bat scope and tampered score facts', () => {
    expect(() => encodeCustomNineAtBatRow({ ...AT_BAT, puzzleId: 'archive-beta-v1-daily-1' })).toThrow();
    expect(() => encodeCustomNineAtBatRow({ ...AT_BAT, puzzleDate: '2026-10-09' })).toThrow();
    expect(() => encodeCustomNineAtBatRow({ ...AT_BAT, awardedPoints: -1 })).toThrow();
    expect(() => decodeCustomNineAtBatRow({ ...encodeCustomNineAtBatRow(AT_BAT), awarded_points: 0.3 })).toThrow();
  });

  it('rejects corrupt or wrong-challenge rows on read', () => {
    const valid = encodeCustomNineCompletedRow(COMPLETION);
    for (const row of [
      { ...valid, challenge_id: 'not_custom' },
      { ...valid, ruleset_version: 'points-v3' },
      { ...valid, summary: { points: '36' } },
      { ...valid, completed_at_bats: [] },
    ]) expect(() => decodeCustomNineCompletedRow(row)).toThrow();
    expect(() => decodeCustomNineAtBatRow(null)).toThrow();
  });
});

describe('private Custom Nine first-write-wins repositories', () => {
  it('persists only to Custom Nine tables; never touches Universal or Archive', async () => {
    const completedRow = encodeCustomNineCompletedRow(COMPLETION);
    const atBatRow = encodeCustomNineAtBatRow(AT_BAT);
    const completeInsert = dbInsert(completedRow);
    const abInsert = dbInsert(atBatRow);
    const from = vi.fn()
      .mockReturnValueOnce({ insert: completeInsert })
      .mockReturnValueOnce({ insert: abInsert });
    const repository = createSupabaseCustomNineCompletedResultRepository(asClient(from));
    const atBats = createSupabaseCustomNineAtBatResultRepository(asClient(from));
    expect(await repository.insertIfAbsent(COMPLETION)).toEqual({ status: 'inserted', result: COMPLETION });
    expect(await atBats.insertIfAbsent(AT_BAT)).toEqual({ status: 'inserted', result: AT_BAT });
    expect(from.mock.calls).toEqual([
      ['custom_nine_completed_results'], ['custom_nine_at_bat_results'],
    ]);
    expect(completeInsert).toHaveBeenCalledWith(completedRow);
    expect(abInsert).toHaveBeenCalledWith(atBatRow);
  });

  it('rereads the immutable completion winner on an atomic unique conflict', async () => {
    const read = dbRead(encodeCustomNineCompletedRow(COMPLETION));
    const from = vi.fn()
      .mockReturnValueOnce({ insert: dbInsert(null, { code: '23505' }) })
      .mockReturnValueOnce({ select: read.select });
    const stored = await createSupabaseCustomNineCompletedResultRepository(asClient(from))
      .insertIfAbsent(COMPLETION);
    expect(stored).toEqual({ status: 'existing', result: COMPLETION });
    expect(read.eq).toHaveBeenCalledWith('submission_id', 'submission_1');
  });

  it('rereads the full four-part at-bat key on conflict', async () => {
    const read = dbRead(encodeCustomNineAtBatRow(AT_BAT));
    const from = vi.fn()
      .mockReturnValueOnce({ insert: dbInsert(null, { code: '23505' }) })
      .mockReturnValueOnce({ select: read.select });
    const stored = await createSupabaseCustomNineAtBatResultRepository(asClient(from))
      .insertIfAbsent(AT_BAT);
    expect(stored).toEqual({ status: 'existing', result: AT_BAT });
    expect(read.eq.mock.calls).toEqual([
      ['attempt_id', 'attempt_1'], ['challenge_id', ID],
      ['ruleset_version', 'points-v4'], ['pitch_number', 3],
    ]);
  });

  it('rejects off-scope inputs without a provider call', async () => {
    const from = vi.fn();
    const repo = createSupabaseCustomNineCompletedResultRepository(asClient(from));
    await expect(repo.insertIfAbsent({ ...COMPLETION, puzzleId: 'daily-1' })).rejects
      .toMatchObject({ kind: 'invalid-row' });
    const atBatRepo = createSupabaseCustomNineAtBatResultRepository(asClient(from));
    await expect(atBatRepo.insertIfAbsent({ ...AT_BAT, rulesetVersion: 'points-v3' })).rejects
      .toMatchObject({ kind: 'invalid-row' });
    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed on malformed database winner, missing conflict winner or provider faults', async () => {
    const malformed = { ...encodeCustomNineCompletedRow(COMPLETION), ruleset_version: 'classic-inning-v1' };
    for (const [winner, kind] of [[malformed, 'invalid-row'], [null, 'query']] as const) {
      const from = vi.fn()
        .mockReturnValueOnce({ insert: dbInsert(null, { code: '23505' }) })
        .mockReturnValueOnce({ select: dbRead(winner).select });
      await expect(createSupabaseCustomNineCompletedResultRepository(asClient(from))
        .insertIfAbsent(COMPLETION)).rejects.toMatchObject({ kind });
    }
    const from = vi.fn().mockReturnValue({ insert: dbInsert(null, { code: '42501', message: 'PRIVATE_DETAIL' }) });
    await expect(createSupabaseCustomNineAtBatResultRepository(asClient(from))
      .insertIfAbsent(AT_BAT)).rejects.toMatchObject({ kind: 'query', message: expect.not.stringContaining('PRIVATE_DETAIL') });
  });
});
