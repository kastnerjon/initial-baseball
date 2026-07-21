import 'server-only';
import type {
  DailyPuzzleEditorialRecord,
  DailyPuzzleRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseDailyPuzzleRepositoryError,
  decodeDailyPuzzleRow,
  encodeDailyPuzzleInsert,
  encodeDailyPuzzleUpdate,
  validateDailyPuzzleRevisionTransition,
} from './supabaseDailyPuzzleRowCodec';

const DAILY_PUZZLES_TABLE = 'daily_puzzles';
const DAILY_PUZZLE_COLUMNS = [
  'id',
  'puzzle_date',
  'puzzle_number',
  'version',
  'revision',
  'status',
  'selections',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'scheduled_at',
  'scheduled_by',
  'published_at',
  'published_by',
  'archived_at',
  'archived_by',
].join(',');

export {
  SupabaseDailyPuzzleRepositoryError,
  type SupabaseDailyPuzzleRepositoryErrorKind,
} from './supabaseDailyPuzzleRowCodec';

export function createSupabaseDailyPuzzleRepository(
  client: SupabaseClient,
): DailyPuzzleRepository {
  return {
    async getByDate(puzzleDate) {
      const { data, error } = await client
        .from(DAILY_PUZZLES_TABLE)
        .select(DAILY_PUZZLE_COLUMNS)
        .eq('puzzle_date', puzzleDate)
        .maybeSingle();

      if (error !== null) throwQueryError('read Daily puzzle', error);
      return data === null ? null : decodeDailyPuzzleRow(data);
    },

    async listByDateRange(startDate, endDate) {
      const { data, error } = await client
        .from(DAILY_PUZZLES_TABLE)
        .select(DAILY_PUZZLE_COLUMNS)
        .gte('puzzle_date', startDate)
        .lte('puzzle_date', endDate)
        .order('puzzle_date', { ascending: true });

      if (error !== null) throwQueryError('list Daily puzzles', error);
      return (data ?? [])
        .map(decodeDailyPuzzleRow)
        .sort((left, right) => left.puzzleDate.localeCompare(right.puzzleDate));
    },

    async save(record, options) {
      validateDailyPuzzleRevisionTransition(record, options);
      return options.expectedRevision === null
        ? insertDailyPuzzle(client, record)
        : updateDailyPuzzle(client, record, options.expectedRevision);
    },
  };
}

async function insertDailyPuzzle(
  client: SupabaseClient,
  record: DailyPuzzleEditorialRecord,
): Promise<DailyPuzzleEditorialRecord> {
  const { data, error } = await client
    .from(DAILY_PUZZLES_TABLE)
    .insert(encodeDailyPuzzleInsert(record))
    .select(DAILY_PUZZLE_COLUMNS)
    .single();

  if (error !== null) {
    if (error.code === '23505') throwConflict(record.puzzleDate, null);
    throwQueryError('create Daily puzzle', error);
  }
  return decodeDailyPuzzleRow(data);
}

async function updateDailyPuzzle(
  client: SupabaseClient,
  record: DailyPuzzleEditorialRecord,
  expectedRevision: number,
): Promise<DailyPuzzleEditorialRecord> {
  const { data, error } = await client
    .from(DAILY_PUZZLES_TABLE)
    .update(encodeDailyPuzzleUpdate(record))
    .eq('puzzle_date', record.puzzleDate)
    .eq('revision', expectedRevision)
    .select(DAILY_PUZZLE_COLUMNS)
    .maybeSingle();

  if (error !== null) throwQueryError('update Daily puzzle', error);
  if (data === null) throwConflict(record.puzzleDate, expectedRevision);
  return decodeDailyPuzzleRow(data);
}

function throwConflict(puzzleDate: string, expectedRevision: number | null): never {
  throw new SupabaseDailyPuzzleRepositoryError(
    'conflict',
    expectedRevision === null
      ? `Daily puzzle already exists for ${puzzleDate}.`
      : `Daily puzzle ${puzzleDate} no longer has expected revision ${expectedRevision}.`,
  );
}

function throwQueryError(operation: string, error: { message: string }): never {
  throw new SupabaseDailyPuzzleRepositoryError('query', `Could not ${operation}: ${error.message}`);
}
