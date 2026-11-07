import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./canonicalDailyPlayerLookup', () => ({
  getCanonicalDailyPlayer: vi.fn((id: string) => ({ displayName: 'Name ' + id })),
}));
vi.mock('./materializePermanentDailyIssuedClueSnapshot', () => ({
  prepareServerOfficialDailyPublication: vi.fn(() => ({ puzzleId: 'private-only' })),
}));

import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import {
  createOfficialDailyEditorialDraft, OfficialDailyDraftError,
  parseOfficialDailyDraftInput, readOfficialDailyEditorialDraftPreview,
  scheduleOfficialDailyEditorialDraft,
} from './serverOfficialDailyEditorialDrafts';

const NOW = new Date('2026-11-05T20:00:00Z');
const ID = '907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const players = Array.from({ length: 9 }, (_, i) => 'fixture-' + (i + 1));
const input = { puzzleDate: '2026-11-06', editionKey: 'modern',
  editionNumber: 2, title: 'Modern', canonicalPlayerIds: players };
const selections = players.map((canonicalPlayerId, i) => ({ slot: i + 1,
  canonicalPlayerId, source: 'manual' }));
const saved = {
  occurrence_id: ID, puzzle_date: '2026-11-06', puzzle_number: 194,
  edition_key: 'modern', edition_number: 2, title: 'Modern',
  selections, status: 'draft', revision: 0, created_by: 'editor',
};

/** Minimal transactional query mock for draft creation and revision CAS. */
function fakeDb(row: Record<string, unknown> | null = saved) {
  const read = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: row, error: null as { message: string } | null })) };
  const write = { select: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: row, error: null })) };
  const updateQuery = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: row === null ? null : { ...row, status: 'scheduled', revision: 1 }, error: null })) };
  const from = vi.fn(() => ({
    insert: vi.fn(() => write), select: vi.fn(() => read),
    update: vi.fn(() => updateQuery),
  }));
  return { client: { from } as unknown as SupabaseClient, from, read, write, updateQuery };
}

beforeEach(() => { vi.mocked(prepareServerOfficialDailyPublication).mockClear(); });

describe('official Daily editorial drafts', () => {
  it('validates future nine-player editions and supplies the default Puzzle N title', () => {
    expect(parseOfficialDailyDraftInput({ ...input, title: undefined }, NOW))
      .toMatchObject({ puzzleDate: '2026-11-06', puzzleNumber: 194,
        editionKey: 'modern', editionNumber: 2, title: 'Puzzle 2',
        selections });
  });

  it.each([
    { ...input, puzzleDate: '2026-11-05' },
    { ...input, puzzleDate: '2026-02-30' },
    { ...input, editionKey: 'Modern/Legends' },
    { ...input, editionNumber: 1 },
    { ...input, canonicalPlayerIds: players.slice(1) },
    { ...input, canonicalPlayerIds: [...players.slice(0, 8), players[0]] },
    { ...input, actorId: 'spoofed-editor' },
    { ...input, canonicalPlayerIds: [' private ', ...players.slice(1)] },
  ])('rejects invalid or unauthorized input before any database access', value => {
    expect(() => parseOfficialDailyDraftInput(value, NOW))
      .toThrowError(expect.objectContaining({ kind: 'invalid' }));
  });

  it('creates a server-owned UUID draft and returns only safe metadata', async () => {
    const db = fakeDb();
    expect(await createOfficialDailyEditorialDraft(db.client, input, 'editor', NOW))
      .toEqual({ status: 'created', occurrenceId: ID, revision: 0 });
    expect(prepareServerOfficialDailyPublication).toHaveBeenCalledWith(
      expect.objectContaining({ editorial: expect.objectContaining({ selections }) }));
    expect(db.from).toHaveBeenCalledWith('official_daily_editorial_drafts');
  });

  it('does not reserve an edition if any canonical player or clue is unavailable', async () => {
    const db = fakeDb();
    vi.mocked(prepareServerOfficialDailyPublication)
      .mockImplementationOnce(() => { throw new Error('private-player-do-not-leak'); });
    await expect(createOfficialDailyEditorialDraft(db.client, input, 'editor', NOW))
      .rejects.toThrowError(expect.objectContaining({ kind: 'invalid' }));
    expect(db.from).not.toHaveBeenCalled();
  });

  it('validates canonical clues before a revision-CAS scheduling update', async () => {
    const db = fakeDb();
    expect(await scheduleOfficialDailyEditorialDraft(db.client, ID, 0, 'editor', NOW))
      .toEqual({ status: 'scheduled', occurrenceId: ID, revision: 1 });
    expect(prepareServerOfficialDailyPublication).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId: ID, editionKey: 'modern',
        editorial: expect.objectContaining({ status: 'scheduled', puzzleNumber: 194, selections }) }));
    expect(db.updateQuery.eq).toHaveBeenCalledWith('revision', 0);
    expect(db.updateQuery.eq).toHaveBeenCalledWith('status', 'draft');
  });

  it('rejects stale updates and missing records without materializing answers', async () => {
    const db = fakeDb();
    await expect(scheduleOfficialDailyEditorialDraft(db.client, ID, 3, 'editor', NOW))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
    expect(prepareServerOfficialDailyPublication).not.toHaveBeenCalled();
    const missing = fakeDb(null);
    await expect(scheduleOfficialDailyEditorialDraft(missing.client, ID, 0, 'editor', NOW))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
  });

  it('treats lost-update races as conflicts rather than claiming scheduling succeeded', async () => {
    const db = fakeDb();
    db.updateQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(scheduleOfficialDailyEditorialDraft(db.client, ID, 0, 'editor', NOW))
      .rejects.toThrowError(expect.objectContaining({ kind: 'conflict' }));
  });

  it('retries a scheduled draft without rerunning clue materialization or an UPDATE', async () => {
    const db = fakeDb({ ...saved, status: 'scheduled', revision: 1 });
    expect(await scheduleOfficialDailyEditorialDraft(db.client, ID, 0, 'editor', NOW))
      .toEqual({ status: 'existing', occurrenceId: ID, revision: 1 });
    expect(prepareServerOfficialDailyPublication).not.toHaveBeenCalled();
    expect(db.updateQuery.select).not.toHaveBeenCalled();
  });

  it('returns sanitized errors when a database response contains future answers', async () => {
    const db = fakeDb();
    db.read.maybeSingle.mockResolvedValueOnce({
      data: null, error: { message: 'private-player-and-hint' },
    });
    try {
      await scheduleOfficialDailyEditorialDraft(db.client, ID, 0, 'editor', NOW);
      throw new Error('Expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(OfficialDailyDraftError);
      expect(String(error)).not.toContain('private-player-and-hint');
    }
  });
});


describe('restricted exact-draft preview', () => {
  it('rejects invalid identifiers/clocks before repository access', async () => {
    const db = fakeDb();
    for (const id of ['daily-ed-v1-' + ID, ID.toUpperCase(), '../' + ID, '']) {
      await expect(readOfficialDailyEditorialDraftPreview(db.client, id, NOW))
        .rejects.toMatchObject({ kind: 'invalid' });
    }
    await expect(readOfficialDailyEditorialDraftPreview(db.client, ID, new Date(NaN)))
      .rejects.toMatchObject({ kind: 'invalid' });
    expect(db.from).not.toHaveBeenCalled();
  });

  it('renders nine ordered names and the current revision without a hidden clue snapshot', async () => {
    const db = fakeDb({ ...saved, selections: [...selections].reverse() });
    const result = await readOfficialDailyEditorialDraftPreview(db.client, ID, NOW);
    expect(result).toMatchObject({
      occurrenceId: ID, puzzleDate: '2026-11-06', editionNumber: 2,
      status: 'draft', revision: 0, canSchedule: true,
    });
    expect(result.selections.map(p => p.slot)).toEqual([1,2,3,4,5,6,7,8,9]);
    expect(result.selections[0]).toEqual({
      slot: 1, canonicalPlayerId: 'fixture-1', displayName: 'Name fixture-1',
    });
    expect(prepareServerOfficialDailyPublication).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toMatch(/hintValues|clueSnapshot|created_by/);
  });

  it('retains visibility but prevents scheduling readiness on missing players or clues', async () => {
    const db = fakeDb();
    vi.mocked(prepareServerOfficialDailyPublication).mockImplementationOnce(() => {
      throw new Error('private-hint-and-player');
    });
    const unready = await readOfficialDailyEditorialDraftPreview(db.client, ID, NOW);
    expect(unready.canSchedule).toBe(false);
    expect(JSON.stringify(unready)).not.toContain('private-hint-and-player');
    vi.mocked(getCanonicalDailyPlayer).mockReturnValueOnce(null);
    const missing = await readOfficialDailyEditorialDraftPreview(db.client, ID, NOW);
    expect(missing.canSchedule).toBe(false);
    expect(missing.selections[0]?.displayName).toBeNull();
  });

  it('never marks an already scheduled, issued, or elapsed draft as schedulable', async () => {
    for (const status of ['scheduled', 'issued'] as const) {
      const result = await readOfficialDailyEditorialDraftPreview(
        fakeDb({ ...saved, status }).client, ID, NOW,
      );
      expect(result.canSchedule).toBe(false);
    }
    const past = await readOfficialDailyEditorialDraftPreview(
      fakeDb().client, ID, new Date('2026-11-06T20:00:00Z'),
    );
    expect(past.canSchedule).toBe(false);
    expect(prepareServerOfficialDailyPublication).not.toHaveBeenCalled();
  });

  it('sanitizes missing, mismatched, malformed and provider-error records', async () => {
    for (const row of [null, { ...saved, occurrence_id: 'bad' },
      { ...saved, occurrence_id: '907f33db-c38f-43c3-8e6b-a3aaf19bbd09' },
      { ...saved, selections: selections.slice(1) }]) {
      await expect(readOfficialDailyEditorialDraftPreview(fakeDb(row).client, ID, NOW))
        .rejects.toBeInstanceOf(OfficialDailyDraftError);
    }
    const db = fakeDb();
    db.read.maybeSingle.mockResolvedValueOnce({
      data: null, error: { message: 'sensitive-private-answers' },
    });
    await expect(readOfficialDailyEditorialDraftPreview(db.client, ID, NOW))
      .rejects.toMatchObject({ kind: 'unavailable' });
  });
});
