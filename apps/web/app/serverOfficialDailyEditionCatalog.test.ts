import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  listPrivateOfficialDailyEditionsByDate,
  listPrivateOfficialDailyArchivePage,
  OfficialDailyCatalogError,
} from './serverOfficialDailyEditionCatalog';

const DATE = '2026-11-06';
const NOW = new Date('2026-11-07T12:00:00.000Z');
const IDS = [
  '907f33db-c38f-43c3-8e6b-a3aaf19bbd08',
  '6077ee21-9370-4cf3-aa21-74c50b485591',
  '269b64cf-1242-4775-a2e3-04b999ae088e',
];
const edition = (number: number) => ({
  puzzle_id: 'daily-ed-v1-' + IDS[number - 2],
  puzzle_date: DATE,
  puzzle_number: 194,
  edition_key: 'puzzle-' + number,
  edition_number: number,
  title: 'Puzzle ' + number,
  schema_version: 1,
  ruleset_version: 'points-v4',
});

type Stored = ReturnType<typeof edition> & Record<string, unknown>;

/** Simulate a metadata-only Supabase query and inspect its filters/projection. */
function database(rows: unknown[], error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: rows, error })),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}

describe('private official Daily date catalog', () => {
  it('returns metadata only, ordered by immutable edition number', async () => {
    const db = database([edition(2), edition(3)]);
    const result = await listPrivateOfficialDailyEditionsByDate(db.client, { puzzleDate: DATE }, NOW);
    expect(result).toEqual({
      puzzleDate: DATE,
      editions: [
        { puzzleId: edition(2).puzzle_id, puzzleDate: DATE, puzzleNumber: 194,
          editionNumber: 2, editionKey: 'puzzle-2', title: 'Puzzle 2' },
        { puzzleId: edition(3).puzzle_id, puzzleDate: DATE, puzzleNumber: 194,
          editionNumber: 3, editionKey: 'puzzle-3', title: 'Puzzle 3' },
      ],
      nextCursor: null,
    });
    expect(db.from).toHaveBeenCalledWith('official_daily_publications');
    expect(db.query.select).toHaveBeenCalledWith(expect.not.stringContaining('clue_snapshot'));
    const selected = db.query.select.mock.calls[0]?.[0] as string;
    expect(selected).not.toContain('canonicalPlayerId');
    expect(selected).not.toContain('hint');
    expect(selected).not.toContain('selections');
    expect(db.query.eq).toHaveBeenCalledWith('puzzle_date', DATE);
    expect(db.query.order).toHaveBeenCalledWith('edition_number', { ascending: true });
    expect(db.query.limit).toHaveBeenCalledWith(51);
    expect(db.query.gt).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private-player');
  });

  it('paginates without silently limiting how many editions a day may contain', async () => {
    const first = database([edition(2), edition(3), edition(4)]);
    const page = await listPrivateOfficialDailyEditionsByDate(first.client,
      { puzzleDate: DATE, pageSize: 2 }, NOW);
    expect(page.editions.map(x => x.editionNumber)).toEqual([2, 3]);
    expect(page.nextCursor).toBe(3);
    expect(first.query.limit).toHaveBeenCalledWith(3);

    const second = database([edition(4)]);
    const rest = await listPrivateOfficialDailyEditionsByDate(second.client,
      { puzzleDate: DATE, pageSize: 2, afterEditionNumber: page.nextCursor! }, NOW);
    expect(second.query.gt).toHaveBeenCalledWith('edition_number', 3);
    expect(rest.editions.map(x => x.editionNumber)).toEqual([4]);
    expect(rest.nextCursor).toBeNull();
  });

  it('hides future editions before Pacific midnight without a database request', async () => {
    const before = database([edition(2)]);
    const early = new Date('2026-11-06T07:59:59.000Z');
    expect(await listPrivateOfficialDailyEditionsByDate(before.client,
      { puzzleDate: DATE }, early))
      .toEqual({ puzzleDate: DATE, editions: [], nextCursor: null });
    expect(before.from).not.toHaveBeenCalled();
    const after = database([edition(2)]);
    const midnight = new Date('2026-11-06T08:00:00.000Z');
    expect((await listPrivateOfficialDailyEditionsByDate(after.client,
      { puzzleDate: DATE }, midnight)).editions).toHaveLength(1);
  });

  it.each([
    { puzzleDate: '2026-02-30' },
    { puzzleDate: 'not-a-date' },
    { puzzleDate: DATE, pageSize: 0 },
    { puzzleDate: DATE, pageSize: 101 },
    { puzzleDate: DATE, pageSize: 1.5 },
    { puzzleDate: DATE, afterEditionNumber: -1 },
    { puzzleDate: DATE, afterEditionNumber: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid query values before accessing storage', async input => {
    const db = database([edition(2)]);
    await expect(listPrivateOfficialDailyEditionsByDate(db.client, input, NOW))
      .rejects.toThrowError(expect.objectContaining({ kind: 'invalid' }));
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([
    [ 'wrong issued ID', { puzzle_id: 'daily-ed-v1-not-a-uuid' } ],
    [ 'wrong date', { puzzle_date: '2026-11-07' } ],
    [ 'wrong daily number', { puzzle_number: 193 } ],
    [ 'wrong ruleset', { ruleset_version: 'points-v5' } ],
    [ 'wrong title', { title: '<private-hint>' } ],
    [ 'wrong key', { edition_key: 'Unsafe/Puzzle' } ],
    [ 'invalid edition', { edition_number: 0 } ],
  ] as const)('fails closed on malformed %s metadata', async (_label, change) => {
    const db = database([{ ...edition(2), ...change }]);
    await expect(listPrivateOfficialDailyEditionsByDate(db.client, { puzzleDate: DATE }, NOW))
      .rejects.toThrowError(expect.objectContaining({ kind: 'unavailable' }));
  });

  it('rejects duplicate/out-of-order pages instead of creating unstable cursors', async () => {
    const db = database([edition(3), edition(2)]);
    await expect(listPrivateOfficialDailyEditionsByDate(db.client, { puzzleDate: DATE }, NOW))
      .rejects.toBeInstanceOf(OfficialDailyCatalogError);
    const dup = database([edition(2), edition(2)]);
    await expect(listPrivateOfficialDailyEditionsByDate(dup.client, { puzzleDate: DATE }, NOW))
      .rejects.toBeInstanceOf(OfficialDailyCatalogError);
  });

  it('redacts private provider errors and does not return partial results', async () => {
    const db = database([edition(2) as Stored], { message: 'private-player secret-hint' });
    try {
      await listPrivateOfficialDailyEditionsByDate(db.client, { puzzleDate: DATE }, NOW);
      throw new Error('Expected a failure');
    } catch (error) {
      expect(error).toBeInstanceOf(OfficialDailyCatalogError);
      expect(String(error)).not.toContain('private-player');
      expect(String(error)).not.toContain('secret-hint');
    }
  });
});

describe('private cross-date Archive catalog', () => {
  const older = { ...edition(4), puzzle_date: '2026-11-05', puzzle_number: 193 };
  it('continues a partially returned day before moving to older dates', async () => {
    const db = database([edition(2), edition(3)]);
    const first = await listPrivateOfficialDailyArchivePage(db.client, { pageSize: 1 }, NOW);
    expect(first.nextCursor).toEqual({ puzzleDate: DATE, editionNumber: 2 });
    expect(first.dates.map(group => group.editions.map(item => item.puzzleId))).toEqual([[edition(2).puzzle_id]]);
    expect(db.query.select).toHaveBeenCalledWith(expect.not.stringContaining('clue_snapshot'));
    expect(db.query.lte).toHaveBeenCalledWith('puzzle_date', '2026-11-07');
    expect(db.query.order.mock.calls).toEqual([['puzzle_date', { ascending: false }], ['edition_number', { ascending: true }]]);
    const next = database([edition(3), older]);
    const page = await listPrivateOfficialDailyArchivePage(next.client, { after: first.nextCursor!, pageSize: 2 }, NOW);
    expect(next.query.or).toHaveBeenCalledWith('puzzle_date.lt.2026-11-06,and(puzzle_date.eq.2026-11-06,edition_number.gt.2)');
    expect(page.dates.map(group => group.puzzleDate)).toEqual([DATE, older.puzzle_date]);
    expect(page.nextCursor).toBeNull();
  });

  it('rejects invalid cursors before query construction and future or stale rows before projection', async () => {
    const db = database([]);
    for (const after of [{ puzzleDate: '2026-11-06,or', editionNumber: 2 }, { puzzleDate: DATE, editionNumber: 0 }]) {
      await expect(listPrivateOfficialDailyArchivePage(db.client, { after }, NOW)).rejects.toMatchObject({ kind: 'invalid' });
    }
    expect(db.from).not.toHaveBeenCalled();
    for (const rows of [[edition(2)], [older, edition(3)], [{ ...edition(3), puzzle_date: '2026-11-08' }]]) {
      await expect(listPrivateOfficialDailyArchivePage(database(rows).client,
        { after: { puzzleDate: DATE, editionNumber: 2 } }, NOW)).rejects.toMatchObject({ kind: 'unavailable' });
    }
  });
});
