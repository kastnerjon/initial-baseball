import { createPermanentDailyIssuedClueSnapshot, type OfficialDailyPublicationInput } from '@initial-baseball/daily';
import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';
import { storeOfficialDailyPublication } from './serverOfficialDailyPublicationStore';

vi.mock('server-only', () => ({}));
vi.mock('./materializePermanentDailyIssuedClueSnapshot', () => ({ prepareServerOfficialDailyPublication: vi.fn() }));

const input: OfficialDailyPublicationInput = {
  occurrenceId: '6758778f-38c4-4f40-9265-30bd27dd72bb', editionKey: 'modern', editionNumber: 2,
  editorial: { status: 'scheduled', selections: Array.from({ length: 9 }, (_, i) => ({
    slot: i + 1, canonicalPlayerId: 'fixture-' + i, source: 'manual',
  })), puzzleDate: '2026-11-06', puzzleNumber: 194 },
};
const puzzle = {
  schemaVersion: 1 as const, puzzleId: 'daily-ed-v1-' + input.occurrenceId,
  puzzleDate: input.editorial.puzzleDate, puzzleNumber: 194,
  editionKey: input.editionKey, editionNumber: 2, title: 'Puzzle 2',
  rulesetVersion: 'points-v4' as const, clueSnapshot: createPermanentDailyIssuedClueSnapshot({
    hintLayout: DEFAULT_DAILY_HINT_CONFIG,
    pitches: input.editorial.selections.map(s => ({
      pitchNumber: s.slot, canonicalPlayerId: s.canonicalPlayerId, initials: 'AB',
      hintValues: ['1980s', 'NYM', 'CF', '3 HR'],
    })),
  }),
};
type Row = Record<string, unknown>;

function database() {
  let stored: Row | null = null;
  let loseResponse = false;
  const maybeSingle = vi.fn(async () => ({ data: stored, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn((row: Row) => ({
    select: () => ({
      single: async () => {
        if (stored) return { data: null, error: { code: '23505' } };
        stored = Object.fromEntries(Object.entries(row).reverse());
        if (loseResponse) throw new Error('private player lookup leaked');
        return { data: stored, error: null };
      },
    }),
  }));
  const client = { from: vi.fn(() => ({ select, insert })) } as unknown as SupabaseClient;
  return { client, insert, eq, maybeSingle, loseNextResponse: () => { loseResponse = true; } };
}

beforeEach(() => vi.mocked(prepareServerOfficialDailyPublication).mockReturnValue(puzzle));

describe('official Daily publication storage', () => {
  it('returns only identity and status, and accepts identical immutable readback on retry', async () => {
    const db = database();
    expect(await storeOfficialDailyPublication(db.client, input)).toEqual({ status: 'created', puzzleId: puzzle.puzzleId });
    expect(await storeOfficialDailyPublication(db.client, input)).toEqual({ status: 'existing', puzzleId: puzzle.puzzleId });
    expect(db.eq).toHaveBeenCalledWith('puzzle_id', puzzle.puzzleId);
  });

  it('recovers an insert whose response was lost, without exposing database details', async () => {
    const db = database();
    db.loseNextResponse();
    await expect(storeOfficialDailyPublication(db.client, input)).rejects.toThrow(/^Unable to verify official Daily publication storage\.$/);
    expect(await storeOfficialDailyPublication(db.client, input)).toEqual({ status: 'existing', puzzleId: puzzle.puzzleId });
  });

  it('rejects changed content and occupied edition slots without overwriting the first row', async () => {
    const db = database();
    await storeOfficialDailyPublication(db.client, input);
    const changedClues = {
      ...puzzle.clueSnapshot, pitches: puzzle.clueSnapshot.pitches.map(p => ({ ...p, initials: 'CD' })),
    };
    vi.mocked(prepareServerOfficialDailyPublication).mockReturnValue({ ...puzzle, clueSnapshot: changedClues });
    expect(await storeOfficialDailyPublication(db.client, input)).toEqual({ status: 'conflict' });
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await storeOfficialDailyPublication(db.client, input)).toEqual({ status: 'conflict' });
  });
});
