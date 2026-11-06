import 'server-only';
import {
  getDailyPuzzleNumber,
  isOfficialDailyEditionKey,
  isOfficialDailyOccurrenceId,
  isOfficialDailyPositiveNumber,
  validateIssuedDailyCalendarDate,
} from '@initial-baseball/daily';
import { parseCustomLineupTitle } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'official_daily_editorial_drafts';
const COLUMNS = 'occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,status,revision';
const MAX_EDITION_NUMBER = 2147483647;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export type PrivateOfficialDailyEditorialEntry = Readonly<{
  occurrenceId: string;
  puzzleDate: string;
  puzzleNumber: number;
  editionKey: string;
  editionNumber: number;
  title: string;
  status: 'draft' | 'scheduled' | 'issued';
  revision: number;
}>;

export type PrivateOfficialDailyEditorialPage = Readonly<{
  puzzleDate: string;
  editions: readonly PrivateOfficialDailyEditorialEntry[];
  nextCursor: number | null;
}>;

export class OfficialDailyEditorialCatalogError extends Error {
  constructor(readonly kind: 'invalid' | 'unavailable') {
    super('Official Daily editorial catalog is unavailable.');
    this.name = 'OfficialDailyEditorialCatalogError';
  }
}

type Query = Readonly<{
  puzzleDate: string;
  afterEditionNumber?: number;
  pageSize?: number;
}>;

function parseQuery(input: Query): Required<Pick<Query, 'puzzleDate' | 'pageSize'>> & {
  afterEditionNumber: number | undefined;
} {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
      || typeof input.puzzleDate !== 'string') {
    throw new OfficialDailyEditorialCatalogError('invalid');
  }
  try {
    validateIssuedDailyCalendarDate(input.puzzleDate);
  } catch {
    throw new OfficialDailyEditorialCatalogError('invalid');
  }
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE
      || (input.afterEditionNumber !== undefined
          && (!isOfficialDailyPositiveNumber(input.afterEditionNumber)
            || input.afterEditionNumber > MAX_EDITION_NUMBER))) {
    throw new OfficialDailyEditorialCatalogError('invalid');
  }
  return { puzzleDate: input.puzzleDate, pageSize, afterEditionNumber: input.afterEditionNumber };
}

function parseRow(value: unknown, puzzleDate: string): PrivateOfficialDailyEditorialEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfficialDailyEditorialCatalogError('unavailable');
  }
  const row = value as Record<string, unknown>;
  const title = row.title;
  if (!isOfficialDailyOccurrenceId(row.occurrence_id)
      || row.puzzle_date !== puzzleDate
      || !isOfficialDailyPositiveNumber(row.puzzle_number)
      || row.puzzle_number !== getDailyPuzzleNumber(puzzleDate)
      || !isOfficialDailyEditionKey(row.edition_key)
      || !isOfficialDailyPositiveNumber(row.edition_number)
      || row.edition_number < 2 || row.edition_number > MAX_EDITION_NUMBER
      || typeof title !== 'string'
      || !['draft', 'scheduled', 'issued'].includes(row.status as string)
      || !Number.isSafeInteger(row.revision) || (row.revision as number) < 0) {
    throw new OfficialDailyEditorialCatalogError('unavailable');
  }
  const parsed = parseCustomLineupTitle(title);
  if (!parsed.ok || parsed.title !== title) {
    throw new OfficialDailyEditorialCatalogError('unavailable');
  }
  return {
    occurrenceId: row.occurrence_id,
    puzzleDate,
    puzzleNumber: row.puzzle_number,
    editionKey: row.edition_key,
    editionNumber: row.edition_number,
    title,
    status: row.status as PrivateOfficialDailyEditorialEntry['status'],
    revision: row.revision as number,
  };
}

/**
 * Private, metadata-only editor read. Does not select ordered players, clue
 * snapshots, authors or hidden answers. A date may have any number of editions;
 * the client follows a keyset cursor rather than relying on a fixed count.
 * Authentication and the default-OFF editor release gate belong to the route.
 */
export async function listPrivateOfficialDailyEditorialDrafts(
  client: SupabaseClient,
  input: Query,
): Promise<PrivateOfficialDailyEditorialPage> {
  const query = parseQuery(input);
  try {
    let builder = client.from(TABLE).select(COLUMNS)
      .eq('puzzle_date', query.puzzleDate)
      .order('edition_number', { ascending: true });
    if (query.afterEditionNumber !== undefined) {
      builder = builder.gt('edition_number', query.afterEditionNumber);
    }
    const { data, error } = await builder.limit(query.pageSize + 1);
    if (error !== null || !Array.isArray(data) || data.length > query.pageSize + 1) {
      throw new OfficialDailyEditorialCatalogError('unavailable');
    }
    const editions = data.map(row => parseRow(row, query.puzzleDate));
    let last = query.afterEditionNumber ?? 0;
    for (const edition of editions) {
      if (edition.editionNumber <= last) throw new OfficialDailyEditorialCatalogError('unavailable');
      last = edition.editionNumber;
    }
    const page = editions.slice(0, query.pageSize);
    return {
      puzzleDate: query.puzzleDate,
      editions: page,
      nextCursor: editions.length > query.pageSize
        ? (page.at(-1)?.editionNumber ?? null)
        : null,
    };
  } catch {
    throw new OfficialDailyEditorialCatalogError('unavailable');
  }
}
