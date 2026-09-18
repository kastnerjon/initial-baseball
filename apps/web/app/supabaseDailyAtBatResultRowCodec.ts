import {
  DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyAtBatResolution,
  type DailyAtBatResult,
  type DailyOutcome,
  type DailyRevealCount,
} from '@initial-baseball/shared';

export type SupabaseDailyAtBatResultRepositoryErrorKind = 'invalid-row' | 'query';

export class SupabaseDailyAtBatResultRepositoryError extends Error {
  constructor(
    public readonly kind: SupabaseDailyAtBatResultRepositoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseDailyAtBatResultRepositoryError';
  }
}

export type DailyAtBatResultRow = {
  attempt_id: string;
  schema_version: number;
  puzzle_id: string;
  puzzle_date: string;
  puzzle_number: number;
  ruleset_version: string;
  pitch_number: number;
  initials: string;
  outcome: string;
  hints_revealed: number;
  wrong_guesses: number;
  resolution: string;
  awarded_points: number;
};

const OUTCOMES = new Set<DailyOutcome>(['HR', '3B', '2B', '1B', 'BB', 'K']);
const RESOLUTIONS = new Set<DailyAtBatResolution>(['correct', 'strikeout', 'give_up']);

export function encodeDailyAtBatResultRow(result: DailyAtBatResult): DailyAtBatResultRow {
  return {
    attempt_id: result.attemptId,
    schema_version: result.schemaVersion,
    puzzle_id: result.puzzleId,
    puzzle_date: result.puzzleDate,
    puzzle_number: result.puzzleNumber,
    ruleset_version: result.rulesetVersion,
    pitch_number: result.atBat.pitchNumber,
    initials: result.atBat.initials,
    outcome: result.atBat.outcome,
    hints_revealed: result.atBat.hintsRevealed,
    wrong_guesses: result.atBat.wrongGuesses,
    resolution: result.atBat.resolution,
    awarded_points: result.awardedPoints,
  };
}

export function decodeDailyAtBatResultRow(row: unknown): DailyAtBatResult {
  const value = record(row, 'Resolved-at-bat row');
  if (value.schema_version !== DAILY_AT_BAT_RESULT_SCHEMA_VERSION) {
    invalid(`Unsupported resolved-at-bat schema version ${String(value.schema_version)}.`);
  }
  if (value.ruleset_version !== POINTS_V3_DAILY_RULESET_VERSION) {
    invalid(`Unsupported resolved-at-bat ruleset ${String(value.ruleset_version)}.`);
  }

  const outcome = value.outcome;
  if (typeof outcome !== 'string' || !OUTCOMES.has(outcome as DailyOutcome)) {
    invalid('outcome is invalid.');
  }
  const resolution = value.resolution;
  if (typeof resolution !== 'string'
    || !RESOLUTIONS.has(resolution as DailyAtBatResolution)) {
    invalid('resolution is invalid.');
  }

  return {
    schemaVersion: DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
    attemptId: attemptId(value.attempt_id),
    puzzleId: text(value.puzzle_id, 'puzzle_id'),
    puzzleDate: calendarDate(value.puzzle_date),
    puzzleNumber: boundedInt(value.puzzle_number, 1, Number.MAX_SAFE_INTEGER, 'puzzle_number'),
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    atBat: {
      pitchNumber: boundedInt(value.pitch_number, 1, 9, 'pitch_number'),
      initials: text(value.initials, 'initials'),
      outcome: outcome as DailyOutcome,
      hintsRevealed: boundedInt(value.hints_revealed, 0, 4, 'hints_revealed') as DailyRevealCount,
      wrongGuesses: boundedInt(value.wrong_guesses, 0, 3, 'wrong_guesses'),
      resolution: resolution as DailyAtBatResolution,
    },
    awardedPoints: boundedInt(value.awarded_points, 0, 7, 'awarded_points'),
  };
}

function attemptId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    invalid('attempt_id is invalid.');
  }
  return value;
}

function calendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid('puzzle_date must be YYYY-MM-DD.');
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    invalid('puzzle_date must be a real calendar date.');
  }
  return value;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

function boundedInt(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    invalid(`${field} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function invalid(message: string): never {
  throw new SupabaseDailyAtBatResultRepositoryError('invalid-row', message);
}
