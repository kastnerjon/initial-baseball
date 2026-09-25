import {
  PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION,
  PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
  PERMANENT_DAILY_SERIES_VERSION,
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedClueSnapshot,
  createPermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedHintLayoutSlot,
  type PermanentDailyIssuedPuzzleRecord,
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
  clue_snapshot: unknown | null;
  issued_at: string;
};

export function encodePermanentDailyIssuedPuzzleRow(
  puzzle: PermanentDailyIssuedPuzzleRecord,
): PermanentDailyIssuedPuzzleRow {
  return {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
    puzzle_date: puzzle.identity.puzzleDate,
    schema_version: puzzle.schemaVersion,
    puzzle_id: puzzle.puzzleId,
    canonical_player_ids: [...puzzle.canonicalPlayerIds],
    clue_snapshot: puzzle.schemaVersion === PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
      ? {
          schemaVersion: puzzle.clueSnapshot.schemaVersion,
          hintLayout: puzzle.clueSnapshot.hintLayout.map(slot => ({ ...slot })),
          pitches: puzzle.clueSnapshot.pitches.map(pitch => ({
            ...pitch,
            hintValues: [...pitch.hintValues],
          })),
        }
      : null,
    issued_at: puzzle.issuedAt,
  };
}

export function decodePermanentDailyIssuedPuzzleRow(
  row: unknown,
): PermanentDailyIssuedPuzzleRecord {
  const value = record(row, 'Permanent Daily issued-puzzle row');

  if (value.series_version !== PERMANENT_DAILY_SERIES_VERSION) {
    invalid(`Unsupported permanent Daily series version ${String(value.series_version)}.`);
  }

  const schemaVersion = positiveInt(value.schema_version, 'schema_version');
  const persistedPuzzleId = text(value.puzzle_id, 'puzzle_id');
  const canonicalPlayerIds = stringArray(value.canonical_player_ids, 'canonical_player_ids');
  const identity = {
    seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
    dailyNumber: positiveInt(value.daily_number, 'daily_number'),
    puzzleDate: calendarDate(value.puzzle_date),
  };
  const issuedAt = timestamp(value.issued_at, 'issued_at');

  let puzzle: PermanentDailyIssuedPuzzleRecord;
  try {
    if (schemaVersion === PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION) {
      if (value.clue_snapshot !== null && value.clue_snapshot !== undefined) {
        invalid('Schema-v1 permanent Daily rows must not contain clue_snapshot.');
      }
      puzzle = createPermanentDailyIssuedPuzzle({
        identity,
        canonicalPlayerIds,
        issuedAt,
      });
    } else if (
      schemaVersion === PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
    ) {
      if (value.clue_snapshot === null || value.clue_snapshot === undefined) {
        invalid('Schema-v2 permanent Daily rows require clue_snapshot.');
      }
      puzzle = createPermanentDailyClueFrozenIssuedPuzzle({
        identity,
        canonicalPlayerIds,
        clueSnapshot: decodeClueSnapshot(value.clue_snapshot),
        issuedAt,
      });
    } else {
      invalid(
        `Unsupported permanent Daily issued-puzzle schema version ${String(schemaVersion)}.`,
      );
    }
  } catch (error) {
    if (error instanceof SupabasePermanentDailyIssuedPuzzleRepositoryError) throw error;
    return invalid(
      error instanceof Error ? error.message : 'Persisted permanent Daily puzzle is invalid.',
    );
  }

  if (persistedPuzzleId !== puzzle.puzzleId) {
    invalid(
      `Persisted puzzle_id ${persistedPuzzleId} does not match permanent identity ${puzzle.puzzleId}.`,
    );
  }

  return puzzle;
}

function decodeClueSnapshot(value: unknown) {
  const snapshot = record(value, 'clue_snapshot');
  if (snapshot.schemaVersion !== PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION) {
    invalid(
      `Unsupported permanent Daily clue snapshot schema version ${String(snapshot.schemaVersion)}.`,
    );
  }

  const hintLayout = array(snapshot.hintLayout, 'clue_snapshot.hintLayout')
    .map((item, index) => {
      const hint = record(item, `clue_snapshot.hintLayout[${index}]`);
      return {
        slot: positiveInt(
          hint.slot,
          `clue_snapshot.hintLayout[${index}].slot`,
        ) as PermanentDailyIssuedHintLayoutSlot['slot'],
        hintType: text(
          hint.hintType,
          `clue_snapshot.hintLayout[${index}].hintType`,
        ) as PermanentDailyIssuedHintLayoutSlot['hintType'],
        displayLabel: text(
          hint.displayLabel,
          `clue_snapshot.hintLayout[${index}].displayLabel`,
        ),
      };
    });

  const pitches = array(snapshot.pitches, 'clue_snapshot.pitches')
    .map((item, index) => {
      const pitch = record(item, `clue_snapshot.pitches[${index}]`);
      return {
        pitchNumber: positiveInt(
          pitch.pitchNumber,
          `clue_snapshot.pitches[${index}].pitchNumber`,
        ),
        canonicalPlayerId: text(
          pitch.canonicalPlayerId,
          `clue_snapshot.pitches[${index}].canonicalPlayerId`,
        ),
        initials: text(
          pitch.initials,
          `clue_snapshot.pitches[${index}].initials`,
        ),
        hintValues: stringArray(
          pitch.hintValues,
          `clue_snapshot.pitches[${index}].hintValues`,
        ),
      };
    });

  try {
    return createPermanentDailyIssuedClueSnapshot({ hintLayout, pitches });
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : 'Persisted permanent Daily clue snapshot is invalid.',
    );
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    invalid(`${field} must be an array.`);
  }
  return value;
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
