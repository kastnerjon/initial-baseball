import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  LegacyPrimaryArchiveError,
  listPrivateLegacyPrimaryDailyPublications,
} from './serverLegacyPrimaryDailyArchiveCatalog';

const NOW = new Date('2026-11-07T12:00:00.000Z');
function row(date: string, number: number) {
  return {
    id: 'daily-' + date + '-v1', puzzle_date: date, puzzle_number: number,
    status: 'published', version: 1, lineup_contract_version: 1,
    published_at: '2026-11-06T08:00:02.356Z',
  };
}
const nov5 = row('2026-11-05', 193);
const nov4 = row('2026-11-04', 192);
const nov3 = row('2026-11-03', 191);
function database(rows: unknown[], error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: rows, error })),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}

describe('private legacy primary publication metadata, not gameplay identity', () => {
  it('reads only published metadata, not selections, answers, authors or derived gameplay IDs', async () => {
    const db = database([nov5, nov4]);
    const page = await listPrivateLegacyPrimaryDailyPublications(db.client, {}, NOW);
    expect(page).toEqual({
      publications: [
        { editorialRecordId: nov5.id, puzzleDate: nov5.puzzle_date,
          puzzleNumber: 193, publishedAt: nov5.published_at },
        { editorialRecordId: nov4.id, puzzleDate: nov4.puzzle_date,
          puzzleNumber: 192, publishedAt: nov4.published_at },
      ], nextCursor: null,
    });
    expect(db.from).toHaveBeenCalledWith('daily_editorial_puzzles');
    const columns = db.query.select.mock.calls[0]![0] as string;
    for (const secret of ['selections', 'canonicalPlayer', 'clue', 'hint', 'created_by', 'published_by']) {
      expect(columns).not.toContain(secret);
    }
    expect(db.query.eq.mock.calls).toEqual([
      ['status', 'published'], ['version', 1], ['lineup_contract_version', 1],
    ]);
    expect(db.query.lt).toHaveBeenCalledWith('puzzle_date', '2026-11-07');
    expect(db.query.lte).toHaveBeenCalledWith('published_at', NOW.toISOString());
    expect(db.query.limit).toHaveBeenCalledWith(31);
    expect(page.publications[0]).not.toHaveProperty('puzzleId');
  });

  it('continues strictly after the last returned date', async () => {
    const first = database([nov5, nov4, nov3]);
    const page = await listPrivateLegacyPrimaryDailyPublications(first.client, { pageSize: 2 }, NOW);
    expect(page.publications.map(p => p.puzzleDate)).toEqual(['2026-11-05', '2026-11-04']);
    expect(page.nextCursor).toBe('2026-11-04');
    const later = database([nov3]);
    const rest = await listPrivateLegacyPrimaryDailyPublications(
      later.client, { afterDate: page.nextCursor!, pageSize: 2 }, NOW,
    );
    expect(later.query.lt).toHaveBeenCalledWith('puzzle_date', '2026-11-04');
    expect(rest.publications.map(p => p.puzzleDate)).toEqual(['2026-11-03']);
    expect(rest.nextCursor).toBeNull();
  });

  it('rejects malformed cursors and page sizes before touching the provider', async () => {
    const bad = [
      { afterDate: '2026-02-30' }, { afterDate: '2026-11-07' },
      { afterDate: '2026-11-08' }, { afterDate: '2026-11-05,or' },
      { pageSize: 0 }, { pageSize: 101 }, { pageSize: 1.5 },
      { afterDate: ['2026-11-05'] }, { unexpected: true },
    ];
    for (const input of bad) {
      const db = database([nov5]);
      await expect(listPrivateLegacyPrimaryDailyPublications(
        db.client, input as never, NOW,
      )).rejects.toMatchObject({ kind: 'invalid' });
      expect(db.from).not.toHaveBeenCalled();
    }
  });

  it('keeps historical eligibility strict at Pacific midnight', async () => {
    const db = database([row('2026-11-06', 194)]);
    await expect(listPrivateLegacyPrimaryDailyPublications(
      db.client, {}, new Date('2026-11-07T07:59:59.000Z'),
    )).rejects.toMatchObject({ kind: 'unavailable' });
    expect(db.query.lt).toHaveBeenCalledWith('puzzle_date', '2026-11-06');
    const after = await listPrivateLegacyPrimaryDailyPublications(
      db.client, {}, new Date('2026-11-07T08:00:00.000Z'),
    );
    expect(after.publications).toHaveLength(1);
    expect(db.query.lt).toHaveBeenCalledWith('puzzle_date', '2026-11-07');
  });

  it.each([
    ['current day', row('2026-11-07', 195)],
    ['future publication timestamp', { ...nov5, published_at: '2026-11-08T00:00:00Z' }],
    ['draft', { ...nov5, status: 'draft' }],
    ['scheduled', { ...nov5, status: 'scheduled' }],
    ['missing proof', { ...nov5, published_at: null }],
    ['bad number', { ...nov5, puzzle_number: 8 }],
    ['wrong version', { ...nov5, version: 2 }],
    ['wrong contract', { ...nov5, lineup_contract_version: 2 }],
    ['spoofed editorial ID', { ...nov5, id: 'daily-2026-11-05-editorial-hash' }],
    ['invalid date', { ...nov5, puzzle_date: '2026-02-30' }],
  ])('rejects %s with no partial results', async (_reason, value) => {
    await expect(listPrivateLegacyPrimaryDailyPublications(
      database([value]).client, {}, NOW,
    )).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('fails closed on duplicates, reordering and cursor violations', async () => {
    for (const rows of [[nov4, nov5], [nov5, nov5]]) {
      await expect(listPrivateLegacyPrimaryDailyPublications(database(rows).client, {}, NOW))
        .rejects.toBeInstanceOf(LegacyPrimaryArchiveError);
    }
    await expect(listPrivateLegacyPrimaryDailyPublications(
      database([nov5]).client, { afterDate: '2026-11-05' }, NOW,
    )).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('redacts provider errors', async () => {
    const db = database([nov5], { message: 'HIDDEN_PLAYERS_OR_PROVIDER_SECRET' });
    try {
      await listPrivateLegacyPrimaryDailyPublications(db.client, {}, NOW);
      throw new Error('Expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(LegacyPrimaryArchiveError);
      expect(String(error)).not.toContain('HIDDEN_PLAYERS_OR_PROVIDER_SECRET');
    }
  });
});
