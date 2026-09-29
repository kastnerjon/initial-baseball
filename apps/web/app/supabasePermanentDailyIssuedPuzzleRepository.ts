import 'server-only';
import type {
  ArchiveBetaDailyClueFrozenIssuedPuzzle,
  ArchiveBetaDailyIssuedPuzzleReadRepository,
  ArchiveBetaDailyIssuedPuzzleRepository,
  PermanentDailyIssuedPuzzleReadRepository,
  PermanentDailyIssuedPuzzleRecord,
  PermanentDailyIssuedPuzzleRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabasePermanentDailyIssuedPuzzleRepositoryError,
  decodeArchiveBetaDailyIssuedPuzzleRow,
  decodePermanentDailyIssuedPuzzleRow,
  encodeArchiveBetaDailyIssuedPuzzleRow,
  encodePermanentDailyIssuedPuzzleRow,
  type PermanentDailyIssuedPuzzleRow,
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

type PersistedIssuedPuzzle =
  | PermanentDailyIssuedPuzzleRecord
  | ArchiveBetaDailyClueFrozenIssuedPuzzle;

type InsertResult<Puzzle extends PersistedIssuedPuzzle> =
  | { status: 'inserted'; puzzle: Puzzle }
  | { status: 'existing'; puzzle: Puzzle };

type RowCodec<Puzzle extends PersistedIssuedPuzzle> = {
  encode(puzzle: Puzzle): PermanentDailyIssuedPuzzleRow;
  decode(row: unknown): Puzzle;
  operationLabel: string;
};

const permanentCodec: RowCodec<PermanentDailyIssuedPuzzleRecord> = {
  encode: encodePermanentDailyIssuedPuzzleRow,
  decode: decodePermanentDailyIssuedPuzzleRow,
  operationLabel: 'permanent Daily issued puzzle',
};

const archiveBetaCodec: RowCodec<ArchiveBetaDailyClueFrozenIssuedPuzzle> = {
  encode: encodeArchiveBetaDailyIssuedPuzzleRow,
  decode: decodeArchiveBetaDailyIssuedPuzzleRow,
  operationLabel: 'archive beta Daily issued puzzle',
};

export {
  SupabasePermanentDailyIssuedPuzzleRepositoryError,
  type SupabasePermanentDailyIssuedPuzzleRepositoryErrorKind,
} from './supabasePermanentDailyIssuedPuzzleRowCodec';

export function createSupabasePermanentDailyIssuedPuzzleRepository(
  client: SupabaseClient,
): PermanentDailyIssuedPuzzleRepository {
  return createWriteRepository(client, permanentCodec);
}

export function createSupabasePermanentDailyIssuedPuzzleReadRepository(
  client: SupabaseClient,
): PermanentDailyIssuedPuzzleReadRepository {
  return createReadRepository(client, permanentCodec);
}

export function createSupabaseArchiveBetaDailyIssuedPuzzleRepository(
  client: SupabaseClient,
): ArchiveBetaDailyIssuedPuzzleRepository {
  return createWriteRepository(client, archiveBetaCodec);
}

export function createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(
  client: SupabaseClient,
): ArchiveBetaDailyIssuedPuzzleReadRepository {
  return createReadRepository(client, archiveBetaCodec);
}

function createWriteRepository<Puzzle extends PersistedIssuedPuzzle>(
  client: SupabaseClient,
  codec: RowCodec<Puzzle>,
) {
  return {
    async insertIfAbsent(puzzle: Puzzle): Promise<InsertResult<Puzzle>> {
      const inserted = await tryInsert(client, puzzle, codec);
      if (inserted !== null) return inserted;
      return readExisting(client, puzzle, codec);
    },
  };
}

function createReadRepository<Puzzle extends PersistedIssuedPuzzle>(
  client: SupabaseClient,
  codec: RowCodec<Puzzle>,
) {
  return {
    getByNumber(query: { seriesVersion: string; dailyNumber: number }) {
      return readOne(client, {
        series_version: query.seriesVersion,
        daily_number: query.dailyNumber,
      }, `read ${codec.operationLabel} by number`, codec);
    },

    getByDate(query: { seriesVersion: string; puzzleDate: string }) {
      return readOne(client, {
        series_version: query.seriesVersion,
        puzzle_date: query.puzzleDate,
      }, `read ${codec.operationLabel} by date`, codec);
    },
  };
}

async function tryInsert<Puzzle extends PersistedIssuedPuzzle>(
  client: SupabaseClient,
  puzzle: Puzzle,
  codec: RowCodec<Puzzle>,
): Promise<InsertResult<Puzzle> | null> {
  const { data, error } = await client
    .from(TABLE)
    .insert(codec.encode(puzzle))
    .select(COLUMNS)
    .single();

  if (error === null) {
    return {
      status: 'inserted',
      puzzle: codec.decode(data),
    };
  }

  if (error.code === '23505') return null;
  throwQueryError(`insert ${codec.operationLabel}`, error);
}

async function readExisting<Puzzle extends PersistedIssuedPuzzle>(
  client: SupabaseClient,
  puzzle: Puzzle,
  codec: RowCodec<Puzzle>,
): Promise<InsertResult<Puzzle>> {
  const existing = await readOne(client, {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
  }, `read existing ${codec.operationLabel}`, codec);

  if (existing === null) {
    throw new SupabasePermanentDailyIssuedPuzzleRepositoryError(
      'query',
      `Issued Daily ${puzzle.puzzleId} conflicted but its existing row could not be read by identity.`,
    );
  }

  return {
    status: 'existing',
    puzzle: existing,
  };
}

async function readOne<Puzzle extends PersistedIssuedPuzzle>(
  client: SupabaseClient,
  match: Record<string, string | number>,
  operation: string,
  codec: RowCodec<Puzzle>,
): Promise<Puzzle | null> {
  const { data, error } = await client
    .from(TABLE)
    .select(COLUMNS)
    .match(match)
    .maybeSingle();

  if (error !== null) throwQueryError(operation, error);
  return data === null ? null : codec.decode(data);
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
