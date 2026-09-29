import {
  PERMANENT_DAILY_ISSUED_CLUE_SNAPSHOT_SCHEMA_VERSION,
  createPermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedHintLayoutSlot,
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

export function decodeIssuedDailyClueSnapshot(value: unknown) {
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
      error instanceof Error ? error.message : 'Persisted Daily clue snapshot is invalid.',
    );
  }
}

export function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

export function positiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    invalid(`${field} must be a positive safe integer.`);
  }
  return value;
}

export function calendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid('puzzle_date must use YYYY-MM-DD.');
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    invalid('puzzle_date must be a real calendar date.');
  }
  return value;
}

export function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    invalid(`${field} must be a timestamp string.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    invalid(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

export function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    invalid(`${field} must be an array of strings.`);
  }
  return [...value];
}

export function invalid(message: string): never {
  throw new SupabasePermanentDailyIssuedPuzzleRepositoryError('invalid-row', message);
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    invalid(`${field} must be an array.`);
  }
  return value;
}
