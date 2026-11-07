import 'server-only';
import {
  getDailyPuzzleNumber, isOfficialDailyOccurrenceId, validateIssuedDailyCalendarDate,
} from '@initial-baseball/daily';
import type { LegacyPrimaryPublicationPage } from './serverLegacyPrimaryDailyArchiveCatalog';
import { getPacificDailyDateString } from './getPacificDailyDateString';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 99; // Backing readers each permit at most 100 records.
const SECONDARY_PREFIX = 'daily-ed-v1-';

export type UnifiedArchiveCursor = Readonly<{ puzzleDate: string; editionNumber: number }>;
type Secondary = Readonly<{ puzzleDate: string; puzzleNumber: number; editionNumber: number;
  puzzleId: string; title: string }>;
type SecondaryPage = Readonly<{
  dates: readonly Readonly<{ puzzleDate: string; editions: readonly Secondary[] }>[];
  nextCursor: UnifiedArchiveCursor | null;
}>;
export type UnifiedArchiveEntry =
  | Readonly<{ kind: 'legacy-primary'; puzzleDate: string; puzzleNumber: number;
      editionNumber: 1; title: 'Puzzle 1'; puzzleId: null }>
  | Readonly<{ kind: 'official-secondary'; puzzleDate: string; puzzleNumber: number;
      editionNumber: number; title: string; puzzleId: string }>;
export type UnifiedArchivePage = Readonly<{
  dates: readonly Readonly<{ puzzleDate: string; editions: readonly UnifiedArchiveEntry[] }>[];
  nextCursor: UnifiedArchiveCursor | null;
}>;
export type UnifiedArchiveSources = Readonly<{
  primary: (query: { afterDate?: string; pageSize: number }, now: Date) =>
    Promise<LegacyPrimaryPublicationPage>;
  secondary: (query: { after?: UnifiedArchiveCursor; pageSize: number }, now: Date) =>
    Promise<SecondaryPage>;
}>;
export class UnifiedDailyArchiveError extends Error {
  constructor(readonly kind: 'invalid' | 'unavailable') {
    super('The official Daily Archive is unavailable.');
    this.name = 'UnifiedDailyArchiveError';
  }
}
type Input = Readonly<{ after?: UnifiedArchiveCursor; pageSize?: number }>;

function parseInput(input: Input, today: string): { after?: UnifiedArchiveCursor; pageSize: number } {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => key !== 'after' && key !== 'pageSize')) {
    throw new UnifiedDailyArchiveError('invalid');
  }
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new UnifiedDailyArchiveError('invalid');
  }
  if (input.after === undefined) return { pageSize };
  const after = input.after;
  if (!after || typeof after !== 'object' || Array.isArray(after)
    || Object.keys(after).sort().join(',') !== 'editionNumber,puzzleDate'
    || !Number.isSafeInteger(after.editionNumber) || after.editionNumber < 1) {
    throw new UnifiedDailyArchiveError('invalid');
  }
  try { validateIssuedDailyCalendarDate(after.puzzleDate); }
  catch { throw new UnifiedDailyArchiveError('invalid'); }
  if (after.puzzleDate >= today) throw new UnifiedDailyArchiveError('invalid');
  return { after, pageSize };
}
function compare(a: Pick<UnifiedArchiveEntry, 'puzzleDate' | 'editionNumber'>,
  b: Pick<UnifiedArchiveEntry, 'puzzleDate' | 'editionNumber'>): number {
  return b.puzzleDate.localeCompare(a.puzzleDate) || a.editionNumber - b.editionNumber;
}
function validateEntry(entry: UnifiedArchiveEntry, today: string): void {
  try { validateIssuedDailyCalendarDate(entry.puzzleDate); }
  catch { throw new UnifiedDailyArchiveError('unavailable'); }
  if (entry.puzzleDate >= today || !Number.isSafeInteger(entry.editionNumber)
    || entry.editionNumber < 1 || entry.puzzleNumber !== getDailyPuzzleNumber(entry.puzzleDate)
    || (entry.kind === 'official-secondary'
      && (entry.editionNumber < 2 || typeof entry.title !== 'string'
        || entry.title.length === 0 || !entry.puzzleId.startsWith(SECONDARY_PREFIX)
        || !isOfficialDailyOccurrenceId(entry.puzzleId.slice(SECONDARY_PREFIX.length))))) {
    throw new UnifiedDailyArchiveError('unavailable');
  }
}

/**
 * Merges independently verified private metadata pages using one date/edition cursor.
 * Primary editorial IDs are NOT game IDs; legacy primary entries have puzzleId=null,
 * never a synthetic route or score admission. This is a source-only read model.
 *
 * Each upstream source must return its first pageSize+1 entries after the cursor.
 * Taking the first pageSize of their ordered union is gap-free even when one
 * historical date contains arbitrarily many secondary editions.
 */
export async function mergePrivateOfficialDailyArchive(
  sources: UnifiedArchiveSources,
  input: Input = {},
  now: Date = new Date(),
): Promise<UnifiedArchivePage> {
  if (!Number.isFinite(now.getTime())) throw new UnifiedDailyArchiveError('invalid');
  const today = getPacificDailyDateString(now);
  const query = parseInput(input, today);
  const limit = query.pageSize + 1;
  try {
    const [primary, secondary] = await Promise.all([
      sources.primary({ pageSize: limit,
        ...(query.after === undefined ? {} : { afterDate: query.after.puzzleDate }) }, now),
      sources.secondary({ pageSize: limit,
        ...(query.after === undefined ? {} : { after: query.after }) }, now),
    ]);
    if (!Array.isArray(primary.publications) || !Array.isArray(secondary.dates)
      || primary.publications.length > limit) throw new UnifiedDailyArchiveError('unavailable');
    const entries: UnifiedArchiveEntry[] = primary.publications.map(record => ({
      kind: 'legacy-primary', puzzleDate: record.puzzleDate,
      puzzleNumber: record.puzzleNumber, editionNumber: 1, title: 'Puzzle 1', puzzleId: null,
    }));
    let secondaryCount = 0;
    for (const group of secondary.dates) {
      if (!Array.isArray(group.editions)) throw new UnifiedDailyArchiveError('unavailable');
      secondaryCount += group.editions.length;
      if (secondaryCount > limit) throw new UnifiedDailyArchiveError('unavailable');
      for (const edition of group.editions) {
        if (edition.puzzleDate !== group.puzzleDate) throw new UnifiedDailyArchiveError('unavailable');
        entries.push({ kind: 'official-secondary', puzzleDate: edition.puzzleDate,
          puzzleNumber: edition.puzzleNumber, editionNumber: edition.editionNumber,
          title: edition.title, puzzleId: edition.puzzleId });
      }
    }
    if (entries.length > limit * 2) throw new UnifiedDailyArchiveError('unavailable');
    for (const entry of entries) {
      validateEntry(entry, today);
      if (query.after && compare(entry, query.after) <= 0) {
        throw new UnifiedDailyArchiveError('unavailable');
      }
    }
    entries.sort(compare);
    // The immutable ID cannot alias two distinct edition slots, including lookahead.
    const seenSecondaryIds = new Set<string>();
    for (const entry of entries) {
      if (entry.kind === 'official-secondary') {
        if (seenSecondaryIds.has(entry.puzzleId)) throw new UnifiedDailyArchiveError('unavailable');
        seenSecondaryIds.add(entry.puzzleId);
      }
    }
    for (let i = 1; i < entries.length; i++) {
      if (compare(entries[i - 1]!, entries[i]!) === 0) {
        throw new UnifiedDailyArchiveError('unavailable');
      }
    }
    const visible = entries.slice(0, query.pageSize);
    const dates: Array<{ puzzleDate: string; editions: UnifiedArchiveEntry[] }> = [];
    for (const entry of visible) {
      const group = dates.at(-1);
      if (group?.puzzleDate === entry.puzzleDate) group.editions.push(entry);
      else dates.push({ puzzleDate: entry.puzzleDate, editions: [entry] });
    }
    const more = entries.length > query.pageSize
      || primary.nextCursor !== null || secondary.nextCursor !== null;
    if (more && visible.length === 0) throw new UnifiedDailyArchiveError('unavailable');
    const last = visible.at(-1);
    return { dates, nextCursor: more && last
      ? { puzzleDate: last.puzzleDate, editionNumber: last.editionNumber } : null };
  } catch {
    throw new UnifiedDailyArchiveError('unavailable');
  }
}
