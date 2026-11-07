import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  listPrivateOfficialDailyEditorialDrafts,
  OfficialDailyEditorialCatalogError,
} from './serverOfficialDailyEditorialCatalog';

const DATE = '2026-11-06';
const id = (n: number) => '907f33db-c38f-43c3-8e6b-' + n.toString(16).padStart(12, '0');
const draft = (n: number, status: 'draft' | 'scheduled' | 'issued' = 'draft') => ({
  occurrence_id: id(n),
  puzzle_date: DATE,
  puzzle_number: 194,
  edition_key: 'puzzle-' + n,
  edition_number: n,
  title: 'Puzzle ' + n,
  status,
  revision: status === 'draft' ? 0 : status === 'scheduled' ? 1 : 2,
  selections: ['PRIVATE_PLAYER_MARKER'],
  clue_snapshot: ['PRIVATE_HINT_MARKER'],
});

function database(rows: unknown[], error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: rows, error })),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}

describe('private official Daily editorial metadata catalog', () => {
  it('lists all statuses without selecting players, authors or clues', async () => {
    const db = database([draft(2), draft(3, 'scheduled'), draft(4, 'issued')]);
    const result = await listPrivateOfficialDailyEditorialDrafts(db.client, { puzzleDate: DATE });
    expect(result).toEqual({
      puzzleDate: DATE,
      editions: [
        { occurrenceId: id(2), puzzleDate: DATE, puzzleNumber: 194,
          editionKey: 'puzzle-2', editionNumber: 2, title: 'Puzzle 2',
          status: 'draft', revision: 0 },
        { occurrenceId: id(3), puzzleDate: DATE, puzzleNumber: 194,
          editionKey: 'puzzle-3', editionNumber: 3, title: 'Puzzle 3',
          status: 'scheduled', revision: 1 },
        { occurrenceId: id(4), puzzleDate: DATE, puzzleNumber: 194,
          editionKey: 'puzzle-4', editionNumber: 4, title: 'Puzzle 4',
          status: 'issued', revision: 2 },
      ],
      nextCursor: null,
    });
    expect(db.from).toHaveBeenCalledWith('official_daily_editorial_drafts');
    expect(db.query.eq).toHaveBeenCalledWith('puzzle_date', DATE);
    expect(db.query.order).toHaveBeenCalledWith('edition_number', { ascending: true });
    const selected: string = db.query.select.mock.calls[0]![0];
    for (const privateColumn of ['selections', 'clue_snapshot', 'created_by',
      'updated_by', 'canonical_player_id']) {
      expect(selected).not.toContain(privateColumn);
    }
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PLAYER_MARKER');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_HINT_MARKER');
  });

  it('pages across 120 editions without imposing a fixed edition count', async () => {
    const first = database(Array.from({ length: 51 }, (_, i) => draft(i + 2)));
    const page = await listPrivateOfficialDailyEditorialDrafts(first.client, { puzzleDate: DATE });
    expect(page.editions).toHaveLength(50);
    expect(page.nextCursor).toBe(51);
    expect(first.query.limit).toHaveBeenCalledWith(51);

    const middle = database(Array.from({ length: 51 }, (_, i) => draft(i + 52)));
    const second = await listPrivateOfficialDailyEditorialDrafts(middle.client,
      { puzzleDate: DATE, afterEditionNumber: page.nextCursor! });
    expect(middle.query.gt).toHaveBeenCalledWith('edition_number', 51);
    expect(second.editions).toHaveLength(50);
    expect(second.nextCursor).toBe(101);

    const last = database(Array.from({ length: 20 }, (_, i) => draft(i + 102)));
    const final = await listPrivateOfficialDailyEditorialDrafts(last.client,
      { puzzleDate: DATE, afterEditionNumber: second.nextCursor! });
    expect(final.editions).toHaveLength(20);
    expect(final.nextCursor).toBeNull();
  });

  it.each([
    { puzzleDate: '2026-02-30' },
    { puzzleDate: '2026-11-6' },
    { puzzleDate: DATE, pageSize: 0 },
    { puzzleDate: DATE, pageSize: 101 },
    { puzzleDate: DATE, pageSize: 1.5 },
    { puzzleDate: DATE, afterEditionNumber: 0 },
    { puzzleDate: DATE, afterEditionNumber: Number.MAX_SAFE_INTEGER },
  ])('rejects malformed queries before database access', async value => {
    const db = database([]);
    await expect(listPrivateOfficialDailyEditorialDrafts(db.client, value))
      .rejects.toMatchObject({ kind: 'invalid' });
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([
    [{ occurrence_id: 'not-a-uuid' }, 'invalid occurrence'],
    [{ puzzle_date: '2026-11-05' }, 'wrong date'],
    [{ puzzle_number: 193 }, 'wrong number'],
    [{ edition_key: 'Private/Unsafe' }, 'wrong key'],
    [{ edition_number: 1 }, 'primary reserved'],
    [{ revision: -1 }, 'negative revision'],
    [{ status: 'deleted' }, 'unknown status'],
    [{ title: '  Private  ' }, 'noncanonical title'],
  ] as const)('fails closed on %s (%s)', async (change, _label) => {
    const db = database([{ ...draft(2), ...change }]);
    await expect(listPrivateOfficialDailyEditorialDrafts(db.client, { puzzleDate: DATE }))
      .rejects.toBeInstanceOf(OfficialDailyEditorialCatalogError);
  });

  it('rejects provider reordering and duplicates rather than issuing a false cursor', async () => {
    for (const rows of [[draft(3), draft(2)], [draft(2), draft(2)]]) {
      const db = database(rows);
      await expect(listPrivateOfficialDailyEditorialDrafts(db.client, { puzzleDate: DATE }))
        .rejects.toMatchObject({ kind: 'unavailable' });
    }
  });

  it('redacts private provider errors and never returns a partial page', async () => {
    const db = database([draft(2)], { message: 'PRIVATE_HINT_MARKER' });
    try {
      await listPrivateOfficialDailyEditorialDrafts(db.client, { puzzleDate: DATE });
      throw new Error('Expected provider failure');
    } catch (error) {
      expect(error).toBeInstanceOf(OfficialDailyEditorialCatalogError);
      expect(String(error)).not.toContain('PRIVATE_HINT_MARKER');
    }
  });
});
