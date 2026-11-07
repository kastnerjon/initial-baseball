import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { LegacyPrimaryPublicationPage } from './serverLegacyPrimaryDailyArchiveCatalog';
import {
  mergePrivateOfficialDailyArchive, UnifiedDailyArchiveError,
  type UnifiedArchiveSources,
} from './unifiedOfficialDailyArchiveMerge';

const NOW = new Date('2026-11-07T12:00:00Z');
const primary = (date: string, number: number) => ({
  editorialRecordId: 'daily-' + date + '-v1', puzzleDate: date, puzzleNumber: number,
  publishedAt: '2026-11-06T08:00:00.000Z',
});
const id = (n: number) => 'daily-ed-v1-' + n.toString(16).padStart(8, '0')
  + '-c38f-43c3-8e6b-a3aaf19bbd08';
const secondary = (date: string, number: number, editionNumber: number) => ({
  puzzleId: id(editionNumber), puzzleDate: date, puzzleNumber: number,
  editionNumber, title: 'Puzzle ' + editionNumber,
});
type Primary = ReturnType<typeof primary>;
type Secondary = ReturnType<typeof secondary>;

function fixture(
  primaries: Primary[] = [primary('2026-11-05', 193), primary('2026-11-04', 192)],
  secondaries: Secondary[] = [secondary('2026-11-05', 193, 2),
    secondary('2026-11-05', 193, 3), secondary('2026-11-04', 192, 2)],
): UnifiedArchiveSources {
  return {
    primary: vi.fn(async query => {
      const list = primaries.filter(x => query.afterDate === undefined
        || x.puzzleDate < query.afterDate).slice(0, query.pageSize + 1);
      return { publications: list.slice(0, query.pageSize),
        nextCursor: list.length > query.pageSize
          ? list[query.pageSize - 1]!.puzzleDate : null } as LegacyPrimaryPublicationPage;
    }),
    secondary: vi.fn(async query => {
      const list = secondaries.filter(x => query.after === undefined
        || x.puzzleDate < query.after.puzzleDate
        || (x.puzzleDate === query.after.puzzleDate
          && x.editionNumber > query.after.editionNumber)).slice(0, query.pageSize + 1);
      const chosen = list.slice(0, query.pageSize);
      const dates: Array<{ puzzleDate: string; editions: Secondary[] }> = [];
      for (const e of chosen) {
        const last = dates.at(-1);
        if (last?.puzzleDate === e.puzzleDate) last.editions.push(e);
        else dates.push({ puzzleDate: e.puzzleDate, editions: [e] });
      }
      const last = chosen.at(-1);
      return { dates, nextCursor: list.length > query.pageSize && last
        ? { puzzleDate: last.puzzleDate, editionNumber: last.editionNumber } : null };
    }),
  };
}

describe('private primary-plus-secondary Archive cursor merger', () => {
  it('places verified primary metadata first without pretending to know its gameplay identity', async () => {
    const sources = fixture();
    const page = await mergePrivateOfficialDailyArchive(sources, {}, NOW);
    expect(page.dates.map(g => [g.puzzleDate, g.editions.map(e => e.editionNumber)]))
      .toEqual([['2026-11-05', [1, 2, 3]], ['2026-11-04', [1, 2]]]);
    expect(page.dates[0]!.editions[0]).toEqual({
      kind: 'legacy-primary', puzzleDate: '2026-11-05', puzzleNumber: 193,
      editionNumber: 1, title: 'Puzzle 1', puzzleId: null,
    });
    expect(page.dates[0]!.editions[1]).toMatchObject({
      kind: 'official-secondary', puzzleId: id(2), title: 'Puzzle 2',
    });
    expect(JSON.stringify(page)).not.toContain('editorialRecordId');
    expect(sources.primary).toHaveBeenCalledWith({ pageSize: 31 }, NOW);
    expect(sources.secondary).toHaveBeenCalledWith({ pageSize: 31 }, NOW);
  });

  it('paginates 121 secondary editions on one date without omitting primaries on older dates', async () => {
    const extra = Array.from({ length: 121 }, (_, i) => secondary('2026-11-05', 193, i + 2))
      .concat([secondary('2026-11-04', 192, 2)]);
    const sources = fixture([primary('2026-11-05', 193), primary('2026-11-04', 192)], extra);
    const visited: string[] = [];
    let after: { puzzleDate: string; editionNumber: number } | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await mergePrivateOfficialDailyArchive(sources,
        { pageSize: 30, ...(after === undefined ? {} : { after }) }, NOW);
      for (const day of page.dates) {
        for (const e of day.editions) visited.push(e.puzzleDate + ':' + e.editionNumber);
      }
      if (page.nextCursor === null) break;
      after = page.nextCursor;
    }
    expect(visited).toHaveLength(124);
    expect(new Set(visited).size).toBe(124);
    expect(visited[0]).toBe('2026-11-05:1');
    expect(visited[1]).toBe('2026-11-05:2');
    expect(visited[121]).toBe('2026-11-05:122');
    expect(visited.slice(-2)).toEqual(['2026-11-04:1', '2026-11-04:2']);
  });

  it('continues the same date after a primary-only page', async () => {
    const sources = fixture();
    const first = await mergePrivateOfficialDailyArchive(sources, { pageSize: 1 }, NOW);
    expect(first.nextCursor).toEqual({ puzzleDate: '2026-11-05', editionNumber: 1 });
    const next = await mergePrivateOfficialDailyArchive(sources,
      { after: first.nextCursor!, pageSize: 1 }, NOW);
    expect(next.dates[0]!.editions[0]).toMatchObject({
      kind: 'official-secondary', editionNumber: 2, puzzleDate: '2026-11-05',
    });
    expect(sources.primary).toHaveBeenLastCalledWith({
      afterDate: '2026-11-05', pageSize: 2,
    }, NOW);
  });

  it('does not invent a primary on a secondary-only date', async () => {
    const page = await mergePrivateOfficialDailyArchive(fixture([], [
      secondary('2026-11-05', 193, 2), secondary('2026-11-05', 193, 3),
    ]), {}, NOW);
    expect(page.dates[0]!.editions.map(e => e.editionNumber)).toEqual([2, 3]);
    expect(page.dates[0]!.editions.every(e => e.puzzleId !== null)).toBe(true);
  });

  it('rejects cursor and size errors before either catalog loads', async () => {
    for (const input of [
      { pageSize: 0 }, { pageSize: 100 }, { pageSize: 1.5 },
      { after: { puzzleDate: '2026-11-07', editionNumber: 1 } },
      { after: { puzzleDate: '2026-02-30', editionNumber: 1 } },
      { after: { puzzleDate: '2026-11-05', editionNumber: 0 } },
      { after: { puzzleDate: '2026-11-05', editionNumber: 1, extra: 1 } },
      { extra: 1 },
    ]) {
      const sources = fixture();
      await expect(mergePrivateOfficialDailyArchive(sources, input as never, NOW))
        .rejects.toMatchObject({ kind: 'invalid' });
      expect(sources.primary).not.toHaveBeenCalled();
      expect(sources.secondary).not.toHaveBeenCalled();
    }
  });

  it('fails closed on edition-one conflicts, duplicate IDs and forged/unreleased rows', async () => {
    for (const extras of [
      [secondary('2026-11-05', 193, 1)],
      [secondary('2026-11-05', 193, 2), secondary('2026-11-05', 193, 2)],
      [secondary('2026-11-07', 195, 2)],
      [{ ...secondary('2026-11-05', 193, 2), puzzleId: 'daily-2026-11-05' }],
      [{ ...secondary('2026-11-05', 193, 2), puzzleNumber: 0 }],
    ]) {
      await expect(mergePrivateOfficialDailyArchive(fixture(
        [primary('2026-11-05', 193)], extras,
      ), {}, NOW)).rejects.toBeInstanceOf(UnifiedDailyArchiveError);
    }
  });

  it('rejects a secondary source that returns more than the requested lookahead limit', async () => {
    const base = fixture([], []);
    const sources: UnifiedArchiveSources = {
      primary: base.primary,
      secondary: vi.fn(async () => ({
        dates: [{ puzzleDate: '2026-11-05',
          editions: Array.from({ length: 32 }, (_, index) =>
            secondary('2026-11-05', 193, index + 2)) }],
        nextCursor: null,
      })),
    };
    await expect(mergePrivateOfficialDailyArchive(sources, { pageSize: 30 }, NOW))
      .rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('rejects secondary exact-ID aliasing across different edition numbers, including lookahead', async () => {
    const first = secondary('2026-11-05', 193, 2);
    const second = { ...secondary('2026-11-05', 193, 3), puzzleId: first.puzzleId };
    for (const size of [1, 30]) {
      await expect(mergePrivateOfficialDailyArchive(
        fixture([], [first, second]), { pageSize: size }, NOW,
      )).rejects.toMatchObject({ kind: 'unavailable' });
    }
  });

  it('redacts provider failures instead of returning partial merged data', async () => {
    const base = fixture();
    const sources: UnifiedArchiveSources = {
      primary: base.primary,
      secondary: vi.fn(async () => { throw new Error('PROVIDER_SECRET_SELECTION'); }),
    };
    await expect(mergePrivateOfficialDailyArchive(sources, {}, NOW))
      .rejects.toMatchObject({ kind: 'unavailable' });
    try {
      await mergePrivateOfficialDailyArchive(sources, {}, NOW);
    } catch (error) {
      expect(String(error)).not.toContain('PROVIDER_SECRET_SELECTION');
    }
  });
});
