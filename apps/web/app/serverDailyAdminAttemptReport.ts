import 'server-only';
import { createEditorialDailyPuzzleId } from '@initial-baseball/daily';
import { requireDailyAdminPrincipal } from './dailyAdminAuthorization';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';
import { decodeDailyAtBatResultRow } from './supabaseDailyAtBatResultRowCodec';
import { decodeDailyCompletedResultRow } from './supabaseDailyCompletedResultRowCodec';
import { ADMIN_ATTEMPT_PAGE_SIZE, buildAdminAttemptReport, readAdminAttemptFilter } from './dailyAdminAttemptReport';
import { getPacificDailyDateString } from './getPacificDailyDateString';

const AB_COLUMNS = 'attempt_id,schema_version,puzzle_id,puzzle_date,puzzle_number,ruleset_version,pitch_number,initials,outcome,hints_revealed,wrong_guesses,resolution,awarded_points,created_at';
const COMPLETED_COLUMNS = 'submission_id,schema_version,puzzle_id,puzzle_date,puzzle_number,ruleset_version,completed_at_bats,summary,created_at';

export async function readDailyAdminAttemptReport(
  authorizationHeader: string | null, params: URLSearchParams,
  dependencies = { createClient: createServerSupabaseClient, currentDate: getPacificDailyDateString },
) {
  requireDailyAdminPrincipal(authorizationHeader);
  const filter = readAdminAttemptFilter(params, dependencies.currentDate());
  const client = dependencies.createClient();
  if (!filter.puzzleId) {
    const editorial = await createSupabaseDailyPuzzleRepository(client).getByDate(filter.date);
    if (editorial) filter.puzzleId = createEditorialDailyPuzzleId(filter.date,
      [...editorial.selections].sort((a, b) => a.slot - b.slot).map(slot => slot.canonicalPlayerId));
  }
  if (!filter.puzzleId) return { filter, rows: [], next: null };
  const read = (table: string, columns: string, id: string, limit: number, after = '', ids?: string[]) => {
    let query = client.from(table).select(columns).eq('puzzle_date', filter.date)
      .eq('puzzle_id', filter.puzzleId).eq('ruleset_version', filter.ruleset).order(id, { ascending: true });
    if (after) query = query.gt(id, after);
    if (ids) query = query.in(id, ids);
    if (table === 'daily_at_bat_results') query = query.order('pitch_number', { ascending: true });
    return query.limit(limit);
  };
  const [abs, completed] = await Promise.all([
    read('daily_at_bat_results', AB_COLUMNS, 'attempt_id', ADMIN_ATTEMPT_PAGE_SIZE * 9 + 1, filter.abAfter),
    read('daily_completed_results', COMPLETED_COLUMNS, 'submission_id', ADMIN_ATTEMPT_PAGE_SIZE + 1, filter.completedAfter),
  ]);
  if (abs.error || completed.error || !Array.isArray(abs.data) || !Array.isArray(completed.data)) {
    throw new Error('Admin attempt reads unavailable.');
  }
  const abRows = records(abs.data);
  const completedRows = records(completed.data);
  const abIds = [...new Set(abRows.map(row => String(row.attempt_id)))];
  const pageAbIds = abIds.slice(0, ADMIN_ATTEMPT_PAGE_SIZE);
  const pageCompleted = completedRows.slice(0, ADMIN_ATTEMPT_PAGE_SIZE);
  const completedIds = pageCompleted.map(row => String(row.submission_id));
  // Advance each stream in the database's own collation order. Never use JS sorting for cursors.
  const [matchingCompletions, matchingAbIds] = await Promise.all([
    pageAbIds.length ? read('daily_completed_results', COMPLETED_COLUMNS, 'submission_id', ADMIN_ATTEMPT_PAGE_SIZE, '', pageAbIds) : { data: [], error: null },
    completedIds.length ? read('daily_at_bat_results', 'attempt_id', 'attempt_id', ADMIN_ATTEMPT_PAGE_SIZE * 9, '', completedIds) : { data: [], error: null },
  ]);
  if (matchingCompletions.error || matchingAbIds.error || !Array.isArray(matchingCompletions.data) || !Array.isArray(matchingAbIds.data)) {
    throw new Error('Admin attempt joins unavailable.');
  }
  const withAb = new Set(records(matchingAbIds.data).map(row => String(row.attempt_id)));
  const pageAbs = abRows.filter(row => pageAbIds.includes(String(row.attempt_id)));
  const pageCompletions = [...records(matchingCompletions.data), ...pageCompleted.filter(row => !withAb.has(String(row.submission_id)))];
  function receipt(row: Record<string, unknown>): string {
    if (typeof row.created_at !== 'string') throw new Error('Invalid admin receipt time.');
    return row.created_at;
  }
  const report = buildAdminAttemptReport(filter,
    pageAbs.map(row => ({ result: decodeDailyAtBatResultRow(row), receivedAt: receipt(row) })),
    pageCompletions.map(row => ({ result: decodeDailyCompletedResultRow(row), receivedAt: receipt(row) })));
  if (abIds.length > ADMIN_ATTEMPT_PAGE_SIZE || completed.data.length > ADMIN_ATTEMPT_PAGE_SIZE) {
    report.next = { ...filter, abAfter: pageAbIds.at(-1) ?? filter.abAfter,
      completedAfter: completedIds.at(-1) ?? filter.completedAfter };
  }
  return report;
}

function records(rows: unknown[]): Record<string, unknown>[] {
  return rows.map(row => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new Error('Invalid admin result row.');
    return row as Record<string, unknown>;
  });
}
