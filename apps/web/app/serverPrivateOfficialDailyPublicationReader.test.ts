import { createPermanentDailyIssuedClueSnapshot } from '@initial-baseball/daily';
import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { readPrivateOfficialDailyPublication } from './serverPrivateOfficialDailyPublicationReader';

vi.mock('server-only', () => ({}));

const puzzleId = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const snapshot = createPermanentDailyIssuedClueSnapshot({
  hintLayout: DEFAULT_DAILY_HINT_CONFIG,
  pitches: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    canonicalPlayerId: 'private-player-' + index,
    initials: 'AB',
    hintValues: ['1980s', 'NYM', 'CF', '3 HR'],
  })),
});
const row: Record<string, unknown> = {
  puzzle_id: puzzleId,
  puzzle_date: '2026-11-06',
  puzzle_number: 194,
  edition_key: 'modern',
  edition_number: 2,
  title: 'Modern',
  schema_version: 1,
  ruleset_version: 'points-v4',
  clue_snapshot: snapshot,
};

function database(data: Record<string, unknown> | null, error: unknown = null) {
  const maybeSingle = vi.fn(async () => ({ data, error }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq };
}

describe('private official Daily exact-ID read', () => {
  it('returns a validated, independently cloned server-private snapshot', async () => {
    const db = database(row);
    const result = await readPrivateOfficialDailyPublication(db.client, puzzleId);
    expect(result).toMatchObject({
      puzzleId, puzzleDate: '2026-11-06', puzzleNumber: 194,
      editionKey: 'modern', editionNumber: 2, title: 'Modern',
      rulesetVersion: 'points-v4',
    });
    expect(result?.clueSnapshot).toEqual(snapshot);
    expect(result?.clueSnapshot).not.toBe(snapshot);
    expect(db.eq).toHaveBeenCalledWith('puzzle_id', puzzleId);
    expect(db.select).toHaveBeenCalledWith(expect.stringContaining('clue_snapshot'));
  });

  it('does not query storage for a malformed or legacy puzzle ID', async () => {
    const db = database(row);
    for (const id of ['daily-2026-11-06-editorial-abc123', 'daily-ed-v1-not-a-uuid', puzzleId.toUpperCase()]) {
      expect(await readPrivateOfficialDailyPublication(db.client, id)).toBeNull();
    }
    expect(db.from).not.toHaveBeenCalled();
  });

  it('returns null only when the exact ID is absent', async () => {
    const db = database(null);
    expect(await readPrivateOfficialDailyPublication(db.client, puzzleId)).toBeNull();
  });

  it.each([
    { label: 'different issued ID', changes: { puzzle_id: 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd09' } },
    { label: 'incorrect daily number', changes: { puzzle_number: 193 } },
    { label: 'wrong ruleset', changes: { ruleset_version: 'points-v5' } },
    { label: 'bad calendar date', changes: { puzzle_date: '2026-02-30' } },
    { label: 'invalid title', changes: { title: ' <not valid>' } },
    { label: 'broken frozen clues', changes: { clue_snapshot: { ...snapshot, pitches: snapshot.pitches.slice(1) } } },
  ])('fails closed on $label without disclosing private fields', async ({ changes }) => {
    const db = database({ ...row, ...changes });
    await expect(readPrivateOfficialDailyPublication(db.client, puzzleId))
      .rejects.toThrow(/^Unable to read official Daily publication\.$/);
  });

  it('redacts database error details containing unrevealed player IDs', async () => {
    const db = database(null, { message: 'private-player-0', code: 'private-player-0' });
    await expect(readPrivateOfficialDailyPublication(db.client, puzzleId))
      .rejects.toThrow(/^Unable to read official Daily publication\.$/);
  });
});
