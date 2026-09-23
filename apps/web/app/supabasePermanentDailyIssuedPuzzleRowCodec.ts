import {
  PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
  PERMANENT_DAILY_SERIES_VERSION,
  createPermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzle,
} from '@initial-baseball/daily';

export type SupabasePermanentDailyIssuedPuzzleRepositoryErrorKind = 'invalid-row' | 'query';

export class SupabasePermanentDailyIssuedPuzzleRepositoryError extends Error {
  constructor(
    public readonly kind: SupabasePermanentDailyIssuedPuzzleRepositoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SupabasePermanentDailyIssuedPuzzleRepositoryError';
  }
}

export type PermanentDailyIssuedPuzzleRow = {
  series_version: string;
  daily_number: number;
  puzzle_date: string;
  schema_version: number;
  puzzle_id: string;
  canonical_player_ids: unknown;
  issued_at: string;
};

export function encodePermanentDailyIssuedPuzzleRow(
  puzzle: PermanentDailyIssuedPuzzle,
): PermanentDailyIssuedPuzzleRow {
  return {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
    puzzle_date: puzzle.identity.puzzleDate,
    schema_version: puzzle.schemaVersion,
    puzzle_id: puzzle.puzzleId,
    canonical_player_ids: [...puzzle.canonicalPlayerIds],
    issued_at: puzzle.issuedAt,
  };
}

export function decodePermanentDailyIssuedPuzzleRow(
  row: unknown,
): PermanentDailyIssuedPuzzle {
  const value = record(row);

  if (value.schema_version !== PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION) {
    invalid(`Unsupported permanent Daily issued-puzzle schema version ${String(value.schema_version)}.`);
  }
  if (value.series_version !== PERMANENT_DAILY_SERIES_VERSION) {
    invalid(`Unsupported permanent Daily series version ${String(value.series_version)}.`);
  }

  const persistedPuzzleId = text(value.puzzle_id, 'puzzle_id');
  const canonicalPlayerIds = stringArray(value.canonical_player_ids, 'canonical_player_ids');

  let puzzle: PermanentDailyIssuedPuzzle;
  try {
    puzzle = createPermanentDailyIssuedPuzzle({
      identity: {
        seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
        dailyNumber: positiveInt(value.daily_number, 'daily_number'),
        puzzleDate: calendarDate(value.puzzle_date),
      },
      canonicalPlayerIds,
      issuedAt: timestamp(value.issued_at, 'issued_at'),
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Persisted permanent Daily puzzle is invalid.');
  }

  if (persistedPuzzleId !== puzzle.puzzleId) {
    invalid(
      `Persisted puzzle_id ${persistedPuzzleId} does not match permanent identity ${puzzle.puzzleId}.`,
    );
  }

  return puzzle;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid('Permanent Daily issued-puzzle row must be an object.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

function positiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    invalid(`${field} must be a positive safe integer.`);
  }
  return value;
}

function calendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid('puzzle_date must use YYYY-MM-DD.');
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    invalid('puzzle_date must be a real calendar date.');
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    invalid(`${field} must be a timestamp string.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    invalid(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    invalid(`${field} must be an array of strings.`);
  }
  return [...value];
}

function invalid(message: string): never {
  throw new SupabasePermanentDailyIssuedPuzzleRepositoryError('invalid-row', message);
}
