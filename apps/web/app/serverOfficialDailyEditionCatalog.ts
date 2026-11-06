import 'server-only';
import {
  getDailyPuzzleNumber,
  isOfficialDailyEditionKey,
  isOfficialDailyOccurrenceId,
  isOfficialDailyPositiveNumber,
  validateIssuedDailyCalendarDate,
} from '@initial-baseball/daily';
import {
  parseCustomLineupTitle,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPacificDailyDateString } from './getPacificDailyDateString';

const TABLE = 'official_daily_publications';
// Never select clue_snapshot or other answer-bearing columns for discovery.
const COLUMNS = 'puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,schema_version,ruleset_version';
const PREFIX = 'daily-ed-v1-';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export type OfficialDailyCatalogEdition = Readonly<{
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  editionNumber: number;
  editionKey: string;
  title: string;
}>;

export type OfficialDailyCatalogPage = Readonly<{
  puzzleDate: string;
  editions: readonly OfficialDailyCatalogEdition[];
  /** Last returned edition number; null when no additional page exists. */
  nextCursor: number | null;
}>;

export class OfficialDailyCatalogError extends Error {
  constructor(readonly kind: 'invalid' | 'unavailable') {
    super('Official Daily edition catalog is unavailable.');
    this.name = 'OfficialDailyCatalogError';
  }
}

type CatalogQuery = Readonly<{
  puzzleDate: string;
  afterEditionNumber?: number;
  pageSize?: number;
}>;

/** Validate private browse parameters before querying any publication metadata. */
function parseQuery(query: CatalogQuery): Required<Pick<CatalogQuery, 'puzzleDate' | 'pageSize'>> & {
  afterEditionNumber: number | undefined;
} {
  if (query === null || typeof query !== 'object' || Array.isArray(query)
      || typeof query.puzzleDate !== 'string') {
    throw new OfficialDailyCatalogError('invalid');
  }
  try {
    validateIssuedDailyCalendarDate(query.puzzleDate);
  } catch {
    throw new OfficialDailyCatalogError('invalid');
  }
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE
      || (query.afterEditionNumber !== undefined
          && !isOfficialDailyPositiveNumber(query.afterEditionNumber))) {
    throw new OfficialDailyCatalogError('invalid');
  }
  return { puzzleDate: query.puzzleDate, pageSize, afterEditionNumber: query.afterEditionNumber };
}

/** Reject malformed, cross-date, or answer-bearing publication metadata. */
function parseRow(value: unknown, expectedDate: string): OfficialDailyCatalogEdition {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfficialDailyCatalogError('unavailable');
  }
  const row = value as Record<string, unknown>;
  const puzzleId = row.puzzle_id;
  const title = row.title;
  if (typeof puzzleId !== 'string' || !puzzleId.startsWith(PREFIX)
      || !isOfficialDailyOccurrenceId(puzzleId.slice(PREFIX.length))
      || row.puzzle_date !== expectedDate
      || !isOfficialDailyPositiveNumber(row.puzzle_number)
      || row.puzzle_number !== getDailyPuzzleNumber(expectedDate)
      || !isOfficialDailyPositiveNumber(row.edition_number)
      || !isOfficialDailyEditionKey(row.edition_key)
      || typeof title !== 'string'
      || row.schema_version !== 1
      || row.ruleset_version !== POINTS_V4_DAILY_RULESET_VERSION) {
    throw new OfficialDailyCatalogError('unavailable');
  }
  const parsedTitle = parseCustomLineupTitle(title);
  if (!parsedTitle.ok || parsedTitle.title !== title) {
    throw new OfficialDailyCatalogError('unavailable');
  }
  return {
    puzzleId,
    puzzleDate: expectedDate,
    puzzleNumber: row.puzzle_number,
    editionNumber: row.edition_number,
    editionKey: row.edition_key,
    title,
  };
}

/**
 * Read one complete, bounded page of an official date's published editions.
 *
 * A single date may contain arbitrarily many editions. Keyset pagination avoids
 * silently truncating a date or imposing a fixed number of puzzles.
 *
 * The table contains only immutable issued publications. Future Pacific dates
 * return no results without storage access. This server-only reader is NOT an
 * authorized public browse route; activation still requires client and scoring
 * isolation. Errors deliberately contain no provider details or private clues.
 */
export async function listPrivateOfficialDailyEditionsByDate(
  client: SupabaseClient,
  input: CatalogQuery,
  now: Date = new Date(),
): Promise<OfficialDailyCatalogPage> {
  const query = parseQuery(input);
  if (query.puzzleDate > getPacificDailyDateString(now)) {
    return { puzzleDate: query.puzzleDate, editions: [], nextCursor: null };
  }

  try {
    const after = query.afterEditionNumber;
    let builder = client.from(TABLE).select(COLUMNS)
      .eq('puzzle_date', query.puzzleDate)
      .order('edition_number', { ascending: true });
    if (after !== undefined) builder = builder.gt('edition_number', after);
    const { data, error } = await builder.limit(query.pageSize + 1);
    if (error !== null || !Array.isArray(data) || data.length > query.pageSize + 1) {
      throw new OfficialDailyCatalogError('unavailable');
    }
    const editions = data.map(row => parseRow(row, query.puzzleDate));
    let last = after ?? 0;
    for (const edition of editions) {
      if (edition.editionNumber <= last) throw new OfficialDailyCatalogError('unavailable');
      last = edition.editionNumber;
    }
    const page = editions.slice(0, query.pageSize);
    return {
      puzzleDate: query.puzzleDate,
      editions: page,
      nextCursor: editions.length > query.pageSize
        ? (page.at(-1)?.editionNumber ?? null) : null,
    };
  } catch {
    throw new OfficialDailyCatalogError('unavailable');
  }
}
