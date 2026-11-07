import 'server-only';
import { getDailyPuzzleNumber, validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPacificDailyDateString } from './getPacificDailyDateString';

// Server metadata only. Never select player selections, clues or actor information.
const FIELDS = 'id,puzzle_date,puzzle_number,version,lineup_contract_version,status,published_at';
const MAX_SIZE = 100;
const DEFAULT_SIZE = 30;

export type LegacyPrimaryPublication = Readonly<{
  editorialRecordId: string;
  puzzleDate: string;
  puzzleNumber: number;
  publishedAt: string;
}>;
export type LegacyPrimaryPublicationPage = Readonly<{
  publications: readonly LegacyPrimaryPublication[];
  nextCursor: string | null;
}>;
export class LegacyPrimaryArchiveError extends Error {
  constructor(readonly kind: 'invalid' | 'unavailable') {
    super('Historical primary Daily metadata is unavailable.');
    this.name = 'LegacyPrimaryArchiveError';
  }
}
type Query = Readonly<{ afterDate?: string; pageSize?: number }>;

function parseInput(input: Query, today: string): { afterDate?: string; pageSize: number } {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => key !== 'afterDate' && key !== 'pageSize')) {
    throw new LegacyPrimaryArchiveError('invalid');
  }
  const pageSize = input.pageSize ?? DEFAULT_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_SIZE) {
    throw new LegacyPrimaryArchiveError('invalid');
  }
  if (input.afterDate !== undefined) {
    try { validateIssuedDailyCalendarDate(input.afterDate); }
    catch { throw new LegacyPrimaryArchiveError('invalid'); }
    if (input.afterDate >= today) throw new LegacyPrimaryArchiveError('invalid');
  }
  return { afterDate: input.afterDate, pageSize };
}

function parseRow(value: unknown, today: string, now: Date): LegacyPrimaryPublication {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LegacyPrimaryArchiveError('unavailable');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.puzzle_date !== 'string' || row.puzzle_date >= today) {
    throw new LegacyPrimaryArchiveError('unavailable');
  }
  try { validateIssuedDailyCalendarDate(row.puzzle_date); }
  catch { throw new LegacyPrimaryArchiveError('unavailable'); }
  const date = row.puzzle_date;
  const publishedAt = row.published_at;
  if (row.id !== 'daily-' + date + '-v1' || row.version !== 1
    || row.lineup_contract_version !== 1 || row.status !== 'published'
    || !Number.isSafeInteger(row.puzzle_number)
    || row.puzzle_number !== getDailyPuzzleNumber(date)
    || typeof publishedAt !== 'string' || publishedAt.length > 64
    || !/(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)$/i.test(publishedAt)) {
    throw new LegacyPrimaryArchiveError('unavailable');
  }
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp) || timestamp > now.getTime()) {
    throw new LegacyPrimaryArchiveError('unavailable');
  }
  return {
    editorialRecordId: row.id, puzzleDate: date,
    puzzleNumber: row.puzzle_number as number,
    publishedAt: new Date(timestamp).toISOString(),
  };
}

/**
 * Private primary editorial publication evidence, not permanent-v1 issuance.
 *
 * The editorial row's ID is NOT the historical gameplay/result puzzle ID, which
 * can be roster-fingerprint or deterministic-fallback based. This reader does
 * not mint permanent identity, expose a link or authorize competitive scoring.
 */
export async function listPrivateLegacyPrimaryDailyPublications(
  client: SupabaseClient,
  input: Query = {},
  now: Date = new Date(),
): Promise<LegacyPrimaryPublicationPage> {
  if (!Number.isFinite(now.getTime())) throw new LegacyPrimaryArchiveError('invalid');
  const today = getPacificDailyDateString(now);
  const query = parseInput(input, today);
  try {
    let builder = client.from('daily_editorial_puzzles').select(FIELDS)
      .eq('status', 'published').eq('version', 1)
      .eq('lineup_contract_version', 1).lt('puzzle_date', today)
      .lte('published_at', now.toISOString())
      .order('puzzle_date', { ascending: false });
    if (query.afterDate !== undefined) {
      builder = builder.lt('puzzle_date', query.afterDate);
    }
    const { data, error } = await builder.limit(query.pageSize + 1);
    if (error !== null || !Array.isArray(data) || data.length > query.pageSize + 1) {
      throw new LegacyPrimaryArchiveError('unavailable');
    }
    const rows = data.map(row => parseRow(row, today, now));
    let previous = query.afterDate ?? today;
    for (const row of rows) {
      if (row.puzzleDate >= previous) throw new LegacyPrimaryArchiveError('unavailable');
      previous = row.puzzleDate;
    }
    const page = rows.slice(0, query.pageSize);
    return {
      publications: page,
      nextCursor: rows.length > query.pageSize ? (page.at(-1)?.puzzleDate ?? null) : null,
    };
  } catch {
    throw new LegacyPrimaryArchiveError('unavailable');
  }
}
