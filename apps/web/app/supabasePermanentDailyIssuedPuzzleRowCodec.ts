import {
  ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  ARCHIVE_BETA_DAILY_SERIES_VERSION,
  PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
  PERMANENT_DAILY_SERIES_VERSION,
  createArchiveBetaDailyClueFrozenIssuedPuzzle,
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedPuzzle,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRecord,
} from '@initial-baseball/daily';
import {
  SupabasePermanentDailyIssuedPuzzleRepositoryError,
  calendarDate,
  decodeIssuedDailyClueSnapshot,
  invalid,
  positiveInt,
  record,
  stringArray,
  text,
  timestamp,
} from './supabaseIssuedDailyPuzzleRowCodecSupport';

export {
  SupabasePermanentDailyIssuedPuzzleRepositoryError,
  type SupabasePermanentDailyIssuedPuzzleRepositoryErrorKind,
} from './supabaseIssuedDailyPuzzleRowCodecSupport';

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

type PersistableIssuedDailyPuzzle =
  | PermanentDailyIssuedPuzzleRecord
  | ArchiveBetaDailyClueFrozenIssuedPuzzle;

export function encodePermanentDailyIssuedPuzzleRow(
  puzzle: PermanentDailyIssuedPuzzleRecord,
): PermanentDailyIssuedPuzzleRow {
  return encodeIssuedDailyPuzzleRow(puzzle);
}

export function encodeArchiveBetaDailyIssuedPuzzleRow(
  puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle,
): PermanentDailyIssuedPuzzleRow {
  if (puzzle.identity.seriesVersion !== ARCHIVE_BETA_DAILY_SERIES_VERSION) {
    invalid(
      `Unsupported archive beta Daily series version ${String(
        puzzle.identity.seriesVersion,
      )}.`,
    );
  }
  if (
    puzzle.schemaVersion
    !== ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
  ) {
    invalid(
      `Unsupported archive beta Daily issued-puzzle schema version ${String(
        puzzle.schemaVersion,
      )}.`,
    );
  }
  return encodeIssuedDailyPuzzleRow(puzzle);
}

export function decodePermanentDailyIssuedPuzzleRow(
  row: unknown,
): PermanentDailyIssuedPuzzleRecord {
  const decoded = decodeIssuedDailyPuzzleRow(row, PERMANENT_DAILY_SERIES_VERSION);
  if (decoded.identity.seriesVersion !== PERMANENT_DAILY_SERIES_VERSION) {
    return invalid('Persisted issued-puzzle row did not decode as permanent-v1.');
  }
  return decoded;
}

export function decodeArchiveBetaDailyIssuedPuzzleRow(
  row: unknown,
): ArchiveBetaDailyClueFrozenIssuedPuzzle {
  const decoded = decodeIssuedDailyPuzzleRow(row, ARCHIVE_BETA_DAILY_SERIES_VERSION);
  if (
    decoded.identity.seriesVersion !== ARCHIVE_BETA_DAILY_SERIES_VERSION
    || decoded.schemaVersion
      !== ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
  ) {
    return invalid('Persisted issued-puzzle row did not decode as archive-beta-v1 schema v2.');
  }
  return decoded;
}

function encodeIssuedDailyPuzzleRow(
  puzzle: PersistableIssuedDailyPuzzle,
): PermanentDailyIssuedPuzzleRow {
  return {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
    puzzle_date: puzzle.identity.puzzleDate,
    schema_version: puzzle.schemaVersion,
    puzzle_id: puzzle.puzzleId,
    canonical_player_ids: [...puzzle.canonicalPlayerIds],
    clue_snapshot: puzzle.schemaVersion === PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION
      ? null
      : {
          schemaVersion: puzzle.clueSnapshot.schemaVersion,
          hintLayout: puzzle.clueSnapshot.hintLayout.map(slot => ({ ...slot })),
          pitches: puzzle.clueSnapshot.pitches.map(pitch => ({
            ...pitch,
            hintValues: [...pitch.hintValues],
          })),
        },
    issued_at: puzzle.issuedAt,
  };
}

function decodeIssuedDailyPuzzleRow(
  row: unknown,
  expectedSeriesVersion: typeof PERMANENT_DAILY_SERIES_VERSION,
): PermanentDailyIssuedPuzzleRecord;
function decodeIssuedDailyPuzzleRow(
  row: unknown,
  expectedSeriesVersion: typeof ARCHIVE_BETA_DAILY_SERIES_VERSION,
): ArchiveBetaDailyClueFrozenIssuedPuzzle;
function decodeIssuedDailyPuzzleRow(
  row: unknown,
  expectedSeriesVersion:
    | typeof PERMANENT_DAILY_SERIES_VERSION
    | typeof ARCHIVE_BETA_DAILY_SERIES_VERSION,
): PersistableIssuedDailyPuzzle {
  const value = record(row, 'Issued Daily puzzle row');

  if (value.series_version !== expectedSeriesVersion) {
    invalid(
      `Unsupported ${seriesLabel(expectedSeriesVersion)} series version ${String(
        value.series_version,
      )}.`,
    );
  }

  const schemaVersion = positiveInt(value.schema_version, 'schema_version');
  const persistedPuzzleId = text(value.puzzle_id, 'puzzle_id');
  const canonicalPlayerIds = stringArray(value.canonical_player_ids, 'canonical_player_ids');
  const dailyNumber = positiveInt(value.daily_number, 'daily_number');
  const puzzleDate = calendarDate(value.puzzle_date);
  const issuedAt = timestamp(value.issued_at, 'issued_at');

  let puzzle: PersistableIssuedDailyPuzzle;
  try {
    if (expectedSeriesVersion === PERMANENT_DAILY_SERIES_VERSION) {
      const identity = {
        seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
        dailyNumber,
        puzzleDate,
      };

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
        puzzle = createPermanentDailyClueFrozenIssuedPuzzle({
          identity,
          canonicalPlayerIds,
          clueSnapshot: requiredClueSnapshot(value.clue_snapshot, 'permanent Daily'),
          issuedAt,
        });
      } else {
        invalid(
          `Unsupported permanent Daily issued-puzzle schema version ${String(
            schemaVersion,
          )}.`,
        );
      }
    } else {
      if (
        schemaVersion
        !== ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
      ) {
        invalid(
          `Unsupported archive beta Daily issued-puzzle schema version ${String(
            schemaVersion,
          )}.`,
        );
      }

      puzzle = createArchiveBetaDailyClueFrozenIssuedPuzzle({
        identity: {
          seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
          dailyNumber,
          puzzleDate,
        },
        canonicalPlayerIds,
        clueSnapshot: requiredClueSnapshot(value.clue_snapshot, 'archive beta Daily'),
        issuedAt,
      });
    }
  } catch (error) {
    if (error instanceof SupabasePermanentDailyIssuedPuzzleRepositoryError) throw error;
    return invalid(
      error instanceof Error ? error.message : 'Persisted issued Daily puzzle is invalid.',
    );
  }

  if (persistedPuzzleId !== puzzle.puzzleId) {
    invalid(
      `Persisted puzzle_id ${persistedPuzzleId} does not match issued identity ${puzzle.puzzleId}.`,
    );
  }

  return puzzle;
}

function requiredClueSnapshot(value: unknown, series: string) {
  if (value === null || value === undefined) {
    invalid(`Schema-v2 ${series} rows require clue_snapshot.`);
  }
  return decodeIssuedDailyClueSnapshot(value);
}

function seriesLabel(
  seriesVersion:
    | typeof PERMANENT_DAILY_SERIES_VERSION
    | typeof ARCHIVE_BETA_DAILY_SERIES_VERSION,
): string {
  return seriesVersion === PERMANENT_DAILY_SERIES_VERSION
    ? 'permanent Daily'
    : 'archive beta Daily';
}
