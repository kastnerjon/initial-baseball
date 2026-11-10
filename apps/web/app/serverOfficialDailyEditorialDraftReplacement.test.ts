import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./canonicalDailyPlayerLookup', () => ({
  getCanonicalDailyPlayer: vi.fn(() => ({ displayName: 'Canonical player' })),
}));
vi.mock('./materializePermanentDailyIssuedClueSnapshot', () => ({
  prepareServerOfficialDailyPublication: vi.fn(() => ({ clueSnapshot: 'PRIVATE_CLUES' })),
}));

import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';
import {
  OfficialDailyDraftError, replaceOfficialDailyEditorialDraftPlayer,
} from './serverOfficialDailyEditorialDrafts';

const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const NOW = new Date('2026-11-05T20:00:00Z');
const selections = Array.from({ length: 9 }, (_, i) => ({
  slot: i + 1, canonicalPlayerId: 'fixture-' + (i + 1), source: 'manual',
}));
const saved = {
  occurrence_id: ID, puzzle_date: '2026-11-06', puzzle_number: 194,
  edition_key: 'modern', edition_number: 2, title: 'Modern',
  selections, status: 'draft', revision: 3, created_by: 'editor',
};

function fakeDb(row: Record<string, unknown> | null = saved) {
  let payload: Record<string, unknown> = {};
  const read = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: row, error: null as unknown })),
  };
  const updateQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: row === null ? null : { ...row, ...payload }, error: null as unknown,
    })),
  };
  const update = vi.fn((value: Record<string, unknown>) => {
    payload = value;
    return updateQuery;
  });
  const from = vi.fn(() => ({ select: vi.fn(() => read), update }));
  return { client: { from } as unknown as SupabaseClient,
    from, read, update, updateQuery };
}

async function replace(
  client: SupabaseClient,
  canonicalPlayerId = 'fixture-10',
  expectedRevision = 3,
  slot = 3,
  now = NOW,
) {
  return replaceOfficialDailyEditorialDraftPlayer(
    client, ID, expectedRevision, slot, canonicalPlayerId, 'editor', now,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('private revision-CAS official Daily player replacement', () => {
  it('replaces one selected slot only after clue readiness, preserving immutable identity', async () => {
    const db = fakeDb();
    const result = await replace(db.client);
    expect(result).toEqual({ status: 'updated', occurrenceId: ID, revision: 4 });
    expect(db.update).toHaveBeenCalledOnce();
    const patch = db.update.mock.calls[0]![0] as Record<string, unknown>;
    const next = patch.selections as typeof selections;
    expect(next.map(x => x.canonicalPlayerId)).toEqual([
      'fixture-1','fixture-2','fixture-10','fixture-4','fixture-5',
      'fixture-6','fixture-7','fixture-8','fixture-9',
    ]);
    expect(patch).not.toHaveProperty('occurrence_id');
    expect(patch).not.toHaveProperty('puzzle_date');
    expect(patch).not.toHaveProperty('edition_key');
    expect(patch.revision).toBe(4);
    expect(db.updateQuery.eq).toHaveBeenCalledWith('status', 'draft');
    expect(db.updateQuery.eq).toHaveBeenCalledWith('revision', 3);
    expect(prepareServerOfficialDailyPublication).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId: ID,
        editorial: expect.objectContaining({ status: 'scheduled', selections: next }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('PRIVATE_CLUES');
  });

  it('treats an identical already selected player as a verified no-op', async () => {
    const db = fakeDb();
    expect(await replace(db.client, 'fixture-3')).toEqual({
      status: 'existing', occurrenceId: ID, revision: 3,
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(prepareServerOfficialDailyPublication).not.toHaveBeenCalled();
  });

  it('rejects invalid IDs, slots, actors, clocks and versions before I/O', async () => {
    const db = fakeDb();
    for (const [id,revision,slot,player,actor,now] of [
      ['daily-ed-v1-' + ID,3,3,'fixture-10','editor',NOW],
      [ID,-1,3,'fixture-10','editor',NOW],
      [ID,3,0,'fixture-10','editor',NOW],
      [ID,3,10,'fixture-10','editor',NOW],
      [ID,3,3,' fixture-10','editor',NOW],
      [ID,3,3,'fixture-10','',NOW],
      [ID,3,3,'fixture-10','editor',new Date(NaN)],
    ] as const) {
      await expect(replaceOfficialDailyEditorialDraftPlayer(
        db.client, id, revision, slot, player, actor, now,
      )).rejects.toMatchObject({ kind: 'invalid' });
    }
    expect(db.from).not.toHaveBeenCalled();
  });

  it('blocks stale revisions, scheduled/issued drafts, elapsed dates and mismatched provider records', async () => {
    for (const [row,expectedRevision,now] of [
      [saved,2,NOW],
      [{ ...saved, status: 'scheduled' },3,NOW],
      [{ ...saved, status: 'issued' },3,NOW],
      [saved,3,new Date('2026-11-06T20:00:00Z')],
      [{ ...saved, occurrence_id: '907f33db-c38f-43c3-8e6b-a3aaf19bbd09' },3,NOW],
    ] as const) {
      const db = fakeDb(row);
      await expect(replace(db.client, 'fixture-10', expectedRevision, 3, now))
        .rejects.toMatchObject({ kind: 'conflict' });
      expect(db.update).not.toHaveBeenCalled();
    }
    expect(prepareServerOfficialDailyPublication).not.toHaveBeenCalled();
  });

  it('prevents duplicate nine-player selections and missing canonical clue material', async () => {
    const duplicate = fakeDb();
    await expect(replace(duplicate.client, 'fixture-2'))
      .rejects.toMatchObject({ kind: 'invalid' });
    expect(duplicate.update).not.toHaveBeenCalled();
    const db = fakeDb();
    vi.mocked(prepareServerOfficialDailyPublication)
      .mockImplementationOnce(() => { throw new Error('PRIVATE_HINT_ANSWER'); });
    await expect(replace(db.client)).rejects.toMatchObject({ kind: 'invalid' });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('detects lost-update CAS failure and malformed database acknowledgements', async () => {
    const raced = fakeDb();
    raced.updateQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(replace(raced.client)).rejects.toMatchObject({ kind: 'conflict' });
    const forged = fakeDb();
    forged.updateQuery.maybeSingle.mockResolvedValueOnce({
      data: { ...saved, revision: 4, selections }, error: null,
    });
    await expect(replace(forged.client)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('sanitizes provider errors without emitting players or hints', async () => {
    const db = fakeDb();
    db.read.maybeSingle.mockResolvedValueOnce({
      data: null, error: { message: 'PRIVATE_FIXTURE_PLAYER_ANSWER' },
    });
    try {
      await replace(db.client);
      throw new Error('Expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(OfficialDailyDraftError);
      expect((error as OfficialDailyDraftError).kind).toBe('unavailable');
      expect(String(error)).not.toContain('PRIVATE_FIXTURE_PLAYER_ANSWER');
    }
  });
});
