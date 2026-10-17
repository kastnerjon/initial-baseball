import {
  createDailyPuzzleDraft, createProspectiveDailyFiveEditorialDraft, getDailyPuzzleNumber,
  type ProspectiveDailyFiveEditorialDraft,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  decodeDailyPuzzleRow, decodeProspectiveDailyFiveDraftRow,
  encodeDailyPuzzleInsert, encodeProspectiveDailyFiveDraftInsert,
} from './supabaseDailyPuzzleRowCodec';
import { createSupabaseProspectiveDailyFiveDraftRepository }
  from './supabaseProspectiveDailyFiveDraftRepository';

const DATE = '2026-11-16';
const TIME = '2026-10-16T20:00:00.000Z';
const player = (i: number) => ({
  slot: i + 1, canonicalPlayerId: 'ibp_' + String(i + 1).padStart(20, '0'),
  source: 'manual' as const,
});
function five(): ProspectiveDailyFiveEditorialDraft {
  return createProspectiveDailyFiveEditorialDraft({
    id: 'future-five-draft', puzzleDate: DATE, puzzleNumber: getDailyPuzzleNumber(DATE),
    selections: Array.from({ length: 5 }, (_, i) => player(i)),
    actorId: 'test-editor', occurredAt: TIME,
  });
}
function legacy() {
  return createDailyPuzzleDraft({
    id: 'current-nine-draft', puzzleDate: DATE, puzzleNumber: getDailyPuzzleNumber(DATE),
    selections: Array.from({ length: 9 }, (_, i) => player(i)),
    actorId: 'test-editor', occurredAt: TIME,
  });
}
function client(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

describe('isolated prospective Daily Five draft storage', () => {
  it('roundtrips five canonical players as explicit v2 untouched draft', () => {
    const draft = five();
    const row = encodeProspectiveDailyFiveDraftInsert(draft);
    expect(row.lineup_contract_version).toBe(2);
    expect(row.selections).toHaveLength(5);
    expect(decodeProspectiveDailyFiveDraftRow(row)).toEqual(draft);
  });

  it('keeps legacy nine-player codec on explicit contract 1, failing closed across versions', () => {
    const row = encodeDailyPuzzleInsert(legacy());
    expect(row.lineup_contract_version).toBe(1);
    expect(decodeDailyPuzzleRow(row)).toEqual(legacy());
    expect(() => decodeDailyPuzzleRow({ ...row, lineup_contract_version: 2 }))
      .toThrow('lineup_contract_version must be 1');
    expect(() => decodeDailyPuzzleRow({ ...row, lineup_contract_version: undefined }))
      .toThrow('lineup_contract_version must be 1');
    expect(() => decodeProspectiveDailyFiveDraftRow(row))
      .toThrow('lineup_contract_version must be 2');
  });

  it('inserts a validated v2 draft using only getByDate and insertDraft', async () => {
    const draft = five();
    const single = vi.fn().mockResolvedValue({
      data: encodeProspectiveDailyFiveDraftInsert(draft), error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const adapter = createSupabaseProspectiveDailyFiveDraftRepository(client(from));
    expect(Object.keys(adapter).sort()).toEqual(['getByDate', 'insertDraft']);
    await expect(adapter.insertDraft(draft)).resolves.toEqual(draft);
    expect(from).toHaveBeenCalledWith('daily_editorial_puzzles');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      lineup_contract_version: 2, status: 'draft', revision: 0,
      selections: draft.selections,
    }));
    expect(select).toHaveBeenCalledWith(expect.stringContaining('lineup_contract_version'));
  });

  it('reads a v2 draft, rejects v1 by date and returns null for missing dates', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: encodeProspectiveDailyFiveDraftInsert(five()), error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const adapter = createSupabaseProspectiveDailyFiveDraftRepository(client(
      vi.fn().mockReturnValue({ select }),
    ));
    await expect(adapter.getByDate(DATE)).resolves.toEqual(five());
    expect(eq).toHaveBeenCalledWith('puzzle_date', DATE);
    maybeSingle.mockResolvedValueOnce({ data: encodeDailyPuzzleInsert(legacy()), error: null });
    await expect(adapter.getByDate(DATE)).rejects.toMatchObject({ kind: 'invalid-row' });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(adapter.getByDate(DATE)).resolves.toBeNull();
  });

  it('blocks invalid drafts before database access and malformed stored rows on decode', async () => {
    const from = vi.fn();
    const adapter = createSupabaseProspectiveDailyFiveDraftRepository(client(from));
    for (const draft of [
      ...[4, 6].map(n => ({ ...five(), selections: Array.from({ length: n }, (_, i) => player(i)) })),
      { ...five(), lineupContractVersion: 1 },
      { ...five(), id: '' },
      { ...five(), id: '   ' },
      { ...five(), status: 'scheduled' },
      { ...five(), revision: 1 },
      { ...five(), publishedAt: TIME },
      { ...five(), updatedBy: 'other-editor' },
      { ...five(), selections: [...five().selections].reverse() },
    ]) {
      await expect(adapter.insertDraft(draft as ProspectiveDailyFiveEditorialDraft))
        .rejects.toMatchObject({ kind: 'invalid-row' });
    }
    expect(from).not.toHaveBeenCalled();
    const row = encodeProspectiveDailyFiveDraftInsert(five());
    for (const bad of [
      { ...row, status: 'scheduled', scheduled_at: TIME, scheduled_by: 'editor' },
      { ...row, revision: 1 },
      { ...row, selections: [...five().selections].slice(0, 4) },
      { ...row, selections: [...five().selections].map((p, i) => i === 4
        ? { ...p, canonicalPlayerId: player(0).canonicalPlayerId } : p) },
      { ...row, puzzle_number: 1 },
    ]) {
      expect(() => decodeProspectiveDailyFiveDraftRow(bad)).toThrow();
    }
  });

  it('maps duplicate-date violations to conflict and rejects changed inserted identity', async () => {
    const single = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
      .mockResolvedValueOnce({ data: { ...encodeProspectiveDailyFiveDraftInsert(five()), id: 'other' },
        error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const adapter = createSupabaseProspectiveDailyFiveDraftRepository(client(
      vi.fn().mockReturnValue({ insert }),
    ));
    await expect(adapter.insertDraft(five())).rejects.toMatchObject({ kind: 'conflict' });
    await expect(adapter.insertDraft(five())).rejects.toMatchObject({ kind: 'invalid-row' });
  });
});
