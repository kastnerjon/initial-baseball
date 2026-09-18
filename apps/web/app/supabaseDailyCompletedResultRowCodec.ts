import {
  CLASSIC_DAILY_RULESET_VERSION,
  DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat,
  type DailyCompletedResult,
  type DailyOutcome,
  type DailyRevealCount,
} from '@initial-baseball/shared';

export type SupabaseDailyCompletedResultRepositoryErrorKind = 'invalid-row' | 'query';

export class SupabaseDailyCompletedResultRepositoryError extends Error {
  constructor(
    public readonly kind: SupabaseDailyCompletedResultRepositoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseDailyCompletedResultRepositoryError';
  }
}

export type DailyCompletedResultRow = {
  submission_id: string;
  schema_version: number;
  puzzle_id: string;
  puzzle_date: string;
  puzzle_number: number;
  ruleset_version: string;
  completed_at_bats: unknown;
  summary: unknown;
};

export function encodeDailyCompletedResultRow(
  result: DailyCompletedResult,
): DailyCompletedResultRow {
  return {
    submission_id: result.submissionId,
    schema_version: result.schemaVersion,
    puzzle_id: result.puzzleId,
    puzzle_date: result.puzzleDate,
    puzzle_number: result.puzzleNumber,
    ruleset_version: result.rulesetVersion,
    completed_at_bats: result.completedAtBats.map(atBat => ({ ...atBat })),
    summary: { ...result.summary },
  };
}

export function decodeDailyCompletedResultRow(row: unknown): DailyCompletedResult {
  if (!isRecord(row)) invalid('Completed-result row must be an object.');

  const submissionId = requireSubmissionId(row.submission_id);
  const schemaVersion = row.schema_version;
  if (schemaVersion !== DAILY_COMPLETED_RESULT_SCHEMA_VERSION) {
    invalid(`Unsupported completed-result schema version ${String(schemaVersion)}.`);
  }

  const puzzleId = requireNonEmptyString(row.puzzle_id, 'puzzle_id');
  const puzzleDate = requireCalendarDate(row.puzzle_date);
  const puzzleNumber = requirePositiveInteger(row.puzzle_number, 'puzzle_number');
  const completedAtBats = requireCompletedAtBats(row.completed_at_bats);

  if (row.ruleset_version === POINTS_V3_DAILY_RULESET_VERSION) {
    return {
      schemaVersion,
      submissionId,
      puzzleId,
      puzzleDate,
      puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedAtBats,
      summary: requirePointsSummary(row.summary),
    };
  }

  if (row.ruleset_version === CLASSIC_DAILY_RULESET_VERSION) {
    return {
      schemaVersion,
      submissionId,
      puzzleId,
      puzzleDate,
      puzzleNumber,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      completedAtBats,
      summary: requireClassicSummary(row.summary),
    };
  }

  return invalid(`Unsupported completed-result ruleset ${String(row.ruleset_version)}.`);
}

function requireCompletedAtBats(value: unknown): DailyCompletedAtBat[] {
  if (!Array.isArray(value)) invalid('completed_at_bats must be an array.');
  return value.map((candidate, index) => requireCompletedAtBat(candidate, index));
}

function requireCompletedAtBat(value: unknown, index: number): DailyCompletedAtBat {
  if (!isRecord(value)) invalid(`completed_at_bats[${index}] must be an object.`);

  const resolution = value.resolution;
  if (resolution !== 'correct' && resolution !== 'strikeout' && resolution !== 'give_up') {
    invalid(`completed_at_bats[${index}].resolution is invalid.`);
  }

  return {
    pitchNumber: requirePositiveInteger(
      value.pitchNumber,
      `completed_at_bats[${index}].pitchNumber`,
    ),
    initials: requireNonEmptyString(
      value.initials,
      `completed_at_bats[${index}].initials`,
    ),
    outcome: requireOutcome(value.outcome, index),
    hintsRevealed: requireRevealCount(value.hintsRevealed, index),
    wrongGuesses: requireIntegerWithin(
      value.wrongGuesses,
      0,
      3,
      `completed_at_bats[${index}].wrongGuesses`,
    ),
    resolution,
  };
}

function requirePointsSummary(value: unknown) {
  if (!isRecord(value)) invalid('points-v3 summary must be an object.');
  return {
    points: requireNonNegativeNumber(value.points, 'summary.points'),
    maximumPoints: requireNonNegativeNumber(value.maximumPoints, 'summary.maximumPoints'),
    atBatsCompleted: requireNonNegativeInteger(
      value.atBatsCompleted,
      'summary.atBatsCompleted',
    ),
    totalAtBats: requirePositiveInteger(value.totalAtBats, 'summary.totalAtBats'),
    completed: requireBoolean(value.completed, 'summary.completed'),
    strikeouts: requireNonNegativeInteger(value.strikeouts, 'summary.strikeouts'),
  };
}

function requireClassicSummary(value: unknown) {
  if (!isRecord(value)) invalid('classic-inning-v1 summary must be an object.');
  return {
    runs: requireNonNegativeInteger(value.runs, 'summary.runs'),
    hits: requireNonNegativeInteger(value.hits, 'summary.hits'),
    outs: requireNonNegativeInteger(value.outs, 'summary.outs'),
    strikeouts: requireNonNegativeInteger(value.strikeouts, 'summary.strikeouts'),
    completed: requireBoolean(value.completed, 'summary.completed'),
    atBatsCompleted: requireNonNegativeInteger(
      value.atBatsCompleted,
      'summary.atBatsCompleted',
    ),
    totalAtBats: requirePositiveInteger(value.totalAtBats, 'summary.totalAtBats'),
  };
}

function requireSubmissionId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    invalid('submission_id is invalid.');
  }
  return value;
}

function requireCalendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid('puzzle_date must be YYYY-MM-DD.');
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    invalid('puzzle_date must be a real calendar date.');
  }

  return value;
}

function requireOutcome(value: unknown, index: number): DailyOutcome {
  if (value !== 'HR'
    && value !== '3B'
    && value !== '2B'
    && value !== '1B'
    && value !== 'BB'
    && value !== 'K') {
    invalid(`completed_at_bats[${index}].outcome is invalid.`);
  }
  return value;
}

function requireRevealCount(value: unknown, index: number): DailyRevealCount {
  return requireIntegerWithin(
    value,
    0,
    4,
    `completed_at_bats[${index}].hintsRevealed`,
  ) as DailyRevealCount;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    invalid(`${field} must be a positive integer.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  return requireIntegerWithin(value, 0, Number.MAX_SAFE_INTEGER, field);
}

function requireIntegerWithin(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (typeof value !== 'number'
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum) {
    invalid(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function requireNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    invalid(`${field} must be a non-negative finite number.`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(`${field} must be boolean.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new SupabaseDailyCompletedResultRepositoryError('invalid-row', message);
}
