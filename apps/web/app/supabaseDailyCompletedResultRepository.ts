import 'server-only';
import type {
  DailyCompletedResultRepository,
  DailyCompletedResultRepositoryInsertResult,
} from '@initial-baseball/daily';
import type { DailyCompletedResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseDailyCompletedResultRepositoryError,
  decodeDailyCompletedResultRow,
  encodeDailyCompletedResultRow,
} from './supabaseDailyCompletedResultRowCodec';

const DAILY_COMPLETED_RESULTS_TABLE = 'daily_completed_results';
const DAILY_COMPLETED_RESULT_COLUMNS = [
  'submission_id',
  'schema_version',
  'puzzle_id',
  'puzzle_date',
  'puzzle_number',
  'ruleset_version',
  'completed_at_bats',
  'summary',
  'created_at',
].join(',');

export {
  SupabaseDailyCompletedResultRepositoryError,
  type SupabaseDailyCompletedResultRepositoryErrorKind,
} from './supabaseDailyCompletedResultRowCodec';

export function createSupabaseDailyCompletedResultRepository(
  client: SupabaseClient,
): DailyCompletedResultRepository {
  return {
    async insertIfAbsent(result) {
      const inserted = await tryInsert(client, result);
      if (inserted !== null) return inserted;
      return readExisting(client, result.submissionId);
    },
  };
}

async function tryInsert(
  client: SupabaseClient,
  result: DailyCompletedResult,
): Promise<DailyCompletedResultRepositoryInsertResult | null> {
  const { data, error } = await client
    .from(DAILY_COMPLETED_RESULTS_TABLE)
    .insert(encodeDailyCompletedResultRow(result))
    .select(DAILY_COMPLETED_RESULT_COLUMNS)
    .single();

  if (error === null) {
    return { status: 'inserted', result: decodeDailyCompletedResultRow(data) };
  }
  if (error.code === '23505') return null;
  throwQueryError('insert completed Daily result', error);
}

async function readExisting(
  client: SupabaseClient,
  submissionId: string,
): Promise<DailyCompletedResultRepositoryInsertResult> {
  const { data, error } = await client
    .from(DAILY_COMPLETED_RESULTS_TABLE)
    .select(DAILY_COMPLETED_RESULT_COLUMNS)
    .eq('submission_id', submissionId)
    .maybeSingle();

  if (error !== null) throwQueryError('read existing completed Daily result', error);
  if (data === null) {
    throw new SupabaseDailyCompletedResultRepositoryError(
      'query',
      `Completed Daily result ${submissionId} conflicted but could not be read.`,
    );
  }
  return { status: 'existing', result: decodeDailyCompletedResultRow(data) };
}

function throwQueryError(operation: string, error: { message: string }): never {
  throw new SupabaseDailyCompletedResultRepositoryError(
    'query',
    `Could not ${operation}: ${error.message}`,
  );
}
