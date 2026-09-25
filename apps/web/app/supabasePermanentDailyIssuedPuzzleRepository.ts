import 'server-only';
import type {
  PermanentDailyIssuedPuzzleReadRepository,
  PermanentDailyIssuedPuzzleRecord,
  PermanentDailyIssuedPuzzleRepository,
  PermanentDailyIssuedPuzzleRepositoryInsertResult,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabasePermanentDailyIssuedPuzzleRepositoryError,
  decodePermanentDailyIssuedPuzzleRow,
  encodePermanentDailyIssuedPuzzleRow,
} from './supabasePermanentDailyIssuedPuzzleRowCodec';

const TABLE = 'permanent_daily_issued_puzzles';
const COLUMNS = [
  'series_version',
  'daily_number',
  'puzzle_date',
  'schema_version',
  'puzzle_id',
  'canonical_player_ids',
  'clue_snapshot',
  'issued_at',
].join(',');

export {
  SupabasePermanentDailyIssuedPuzzleRepositoryError,
  type SupabasePermanentDailyIssuedPuzzleRepositoryErrorKind,
} from './supabasePermanentDailyIssuedPuzzleRowCodec';

export function createSupabasePermanentDailyIssuedPuzzleRepository(
  client: SupabaseClient,
): PermanentDailyIssuedPuzzleRepository {
  return {
    async insertIfAbsent(puzzle) {
      const inserted = await tryInsert(client, puzzle);
      if (inserted !== null) return inserted;
      return readExisting(client, puzzle);
    },
  };
}

export function createSupabasePermanentDailyIssuedPuzzleReadRepository(
  client: SupabaseClient,
): PermanentDailyIssuedPuzzleReadRepository {
  return {
    getByNumber(query) {
      return readOne(client, {
        series_version: query.seriesVersion,
        daily_number: query.dailyNumber,
      }, 'read permanent Daily issued puzzle by number');
    },

    getByDate(query) {
      return readOne(client, {
        series_version: query.seriesVersion,
        puzzle_date: query.puzzleDate,
      }, 'read permanent Daily issued puzzle by date');
    },
  };
}

async function tryInsert(
  client: SupabaseClient,
  puzzle: PermanentDailyIssuedPuzzleRecord,
): Promise<PermanentDailyIssuedPuzzleRepositoryInsertResult | null> {
  const { data, error } = await client
    .from(TABLE)
    .insert(encodePermanentDailyIssuedPuzzleRow(puzzle))
    .select(COLUMNS)
    .single();

  if (error === null) {
    return {
      status: 'inserted',
      puzzle: decodePermanentDailyIssuedPuzzleRow(data),
    };
  }

  if (error.code === '23505') return null;
  throwQueryError('insert permanent Daily issued puzzle', error);
}

async function readExisting(
  client: SupabaseClient,
  puzzle: PermanentDailyIssuedPuzzleRecord,
): Promise<PermanentDailyIssuedPuzzleRepositoryInsertResult> {
  const existing = await readOne(client, {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
  }, 'read existing permanent Daily issued puzzle');

  if (existing === null) {
    throw new SupabasePermanentDailyIssuedPuzzleRepositoryError(
      'query',
      `Permanent Daily ${puzzle.puzzleId} conflicted but its existing row could not be read by identity.`,
    );
  }

  return {
    status: 'existing',
    puzzle: existing,
  };
}

async function readOne(
  client: SupabaseClient,
  match: Record<string, string | number>,
  operation: string,
): Promise<PermanentDailyIssuedPuzzleRecord | null> {
  const { data, error } = await client
    .from(TABLE)
    .select(COLUMNS)
    .match(match)
    .maybeSingle();

  if (error !== null) throwQueryError(operation, error);
  return data === null ? null : decodePermanentDailyIssuedPuzzleRow(data);
}

function throwQueryError(
  operation: string,
  error: { message: string },
): never {
  throw new SupabasePermanentDailyIssuedPuzzleRepositoryError(
    'query',
    `Could not ${operation}: ${error.message}`,
  );
}
