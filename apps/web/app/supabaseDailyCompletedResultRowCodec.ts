import { getDailyPointsRange } from '@initial-baseball/engine';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyAtBatResolution,
  type DailyCompletedAtBat,
  type DailyCompletedPointsResultRulesetVersion,
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

const OUTCOMES = new Set<DailyOutcome>(['HR', '3B', '2B', '1B', 'BB', 'K']);
const RESOLUTIONS = new Set<DailyAtBatResolution>(['correct', 'strikeout', 'give_up']);

export function encodeDailyCompletedResultRow(result: DailyCompletedResult): DailyCompletedResultRow {
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
  const value = record(row, 'Completed-result row');
  const schemaVersion = value.schema_version;
  if (schemaVersion !== DAILY_COMPLETED_RESULT_SCHEMA_VERSION) {
    invalid(`Unsupported completed-result schema version ${String(schemaVersion)}.`);
  }

  const common = {
    schemaVersion,
    submissionId: submissionId(value.submission_id),
    puzzleId: text(value.puzzle_id, 'puzzle_id'),
    puzzleDate: calendarDate(value.puzzle_date),
    puzzleNumber: positiveInt(value.puzzle_number, 'puzzle_number'),
    completedAtBats: completedAtBats(value.completed_at_bats),
  };

  if (
    value.ruleset_version === POINTS_V3_DAILY_RULESET_VERSION
    || value.ruleset_version === POINTS_V4_DAILY_RULESET_VERSION
  ) {
    const rulesetVersion = value.ruleset_version;
    return {
      ...common,
      rulesetVersion,
      summary: pointsSummary(value.summary, rulesetVersion),
    };
  }

  if (value.ruleset_version === CLASSIC_DAILY_RULESET_VERSION) {
    return {
      ...common,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      summary: classicSummary(value.summary),
    };
  }

  return invalid(`Unsupported completed-result ruleset ${String(value.ruleset_version)}.`);
}

function completedAtBats(value: unknown): DailyCompletedAtBat[] {
  if (!Array.isArray(value)) invalid('completed_at_bats must be an array.');
  return value.map((candidate, index) => {
    const row = record(candidate, `completed_at_bats[${index}]`);
    const outcome = row.outcome;
    const resolution = row.resolution;
    if (typeof outcome !== 'string' || !OUTCOMES.has(outcome as DailyOutcome)) {
      invalid(`completed_at_bats[${index}].outcome is invalid.`);
    }
    if (typeof resolution !== 'string'
      || !RESOLUTIONS.has(resolution as DailyAtBatResolution)) {
      invalid(`completed_at_bats[${index}].resolution is invalid.`);
    }
    return {
      pitchNumber: positiveInt(row.pitchNumber, `completed_at_bats[${index}].pitchNumber`),
      initials: text(row.initials, `completed_at_bats[${index}].initials`),
      outcome: outcome as DailyOutcome,
      hintsRevealed: boundedInt(
        row.hintsRevealed,
        0,
        4,
        `completed_at_bats[${index}].hintsRevealed`,
      ) as DailyRevealCount,
      wrongGuesses: boundedInt(
        row.wrongGuesses,
        0,
        3,
        `completed_at_bats[${index}].wrongGuesses`,
      ),
      resolution: resolution as DailyAtBatResolution,
    };
  });
}

function pointsSummary(
  value: unknown,
  rulesetVersion: DailyCompletedPointsResultRulesetVersion,
) {
  const row = record(value, `${rulesetVersion} summary`);
  const totalAtBats = exactInt(row.totalAtBats, 9, 'summary.totalAtBats');
  const range = getDailyPointsRange(rulesetVersion, totalAtBats);
  if (range === null) {
    invalid(`Unsupported persisted point range for ${rulesetVersion}.`);
  }

  return {
    points: boundedPoints(
      row.points,
      range.minimumPoints,
      range.maximumPoints,
      range.step,
      'summary.points',
    ),
    maximumPoints: exactInt(
      row.maximumPoints,
      range.maximumPoints,
      'summary.maximumPoints',
    ),
    atBatsCompleted: nonNegativeInt(row.atBatsCompleted, 'summary.atBatsCompleted'),
    totalAtBats,
    completed: bool(row.completed, 'summary.completed'),
    strikeouts: nonNegativeInt(row.strikeouts, 'summary.strikeouts'),
  };
}

function classicSummary(value: unknown) {
  const row = record(value, 'classic-inning-v1 summary');
  return {
    runs: nonNegativeInt(row.runs, 'summary.runs'),
    hits: nonNegativeInt(row.hits, 'summary.hits'),
    outs: nonNegativeInt(row.outs, 'summary.outs'),
    strikeouts: nonNegativeInt(row.strikeouts, 'summary.strikeouts'),
    completed: bool(row.completed, 'summary.completed'),
    atBatsCompleted: nonNegativeInt(row.atBatsCompleted, 'summary.atBatsCompleted'),
    totalAtBats: positiveInt(row.totalAtBats, 'summary.totalAtBats'),
  };
}

function submissionId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    invalid('submission_id is invalid.');
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

function boundedPoints(
  value: unknown,
  min: number,
  max: number,
  step: number,
  field: string,
): number {
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || Math.abs(value) > Number.MAX_SAFE_INTEGER
    || value < min
    || value > max
    || !Number.isSafeInteger(value / step)) {
    invalid(`${field} must be between ${min} and ${max} in ${step}-point steps.`);
  }
  return value;
}

function exactInt(value: unknown, expected: number, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value !== expected) {
    invalid(`${field} must equal ${expected}.`);
  }
  return value;
}

function positiveInt(value: unknown, field: string): number {
  return boundedInt(value, 1, Number.MAX_SAFE_INTEGER, field);
}

function nonNegativeInt(value: unknown, field: string): number {
  return boundedInt(value, 0, Number.MAX_SAFE_INTEGER, field);
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(`${field} must be boolean.`);
  return value;
}

function invalid(message: string): never {
  throw new SupabaseDailyCompletedResultRepositoryError('invalid-row', message);
}
