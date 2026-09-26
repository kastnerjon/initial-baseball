import 'server-only';
import type {
  DailyNineAtBatComparisonSource,
  DailyNineAtBatComparisonQuery,
  DailyNineComparisonKey,
  DailyNineComparisonRepository,
  DailyNineCompletedComparisonSource,
  DailyNineScoreBucket,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  measureDailyNineComparisonStage,
  measureDailyNineComparisonSyncStage,
  type DailyNineComparisonStageTimings,
} from './dailyNineComparisonTiming';

const AT_BAT_COMPARISON_FUNCTION = 'daily_nine_at_bat_comparison';
const COMPLETED_COMPARISON_FUNCTION = 'daily_nine_completed_score_buckets';

export type SupabaseDailyNineComparisonRepositoryErrorKind = 'invalid-row' | 'query';

export class SupabaseDailyNineComparisonRepositoryError extends Error {
  constructor(
    public readonly kind: SupabaseDailyNineComparisonRepositoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseDailyNineComparisonRepositoryError';
  }
}

type SupabaseDailyNineComparisonRepositoryOptions = {
  timings?: DailyNineComparisonStageTimings;
  now?: () => number;
};

export function createSupabaseDailyNineComparisonRepository(
  client: SupabaseClient,
  options: SupabaseDailyNineComparisonRepositoryOptions = {},
): DailyNineComparisonRepository {
  const now = options.now ?? Date.now;

  async function measureRpc<T>(operation: () => Promise<T>): Promise<T> {
    if (options.timings === undefined) return operation();
    return measureDailyNineComparisonStage(
      options.timings,
      'provider-rpc',
      operation,
      now,
    );
  }

  function measureDecode<T>(operation: () => T): T {
    if (options.timings === undefined) return operation();
    return measureDailyNineComparisonSyncStage(
      options.timings,
      'provider-decode',
      operation,
      now,
    );
  }

  return {
    async readAtBat(query) {
      const { data, error } = await measureRpc(
        async () => client.rpc(
          AT_BAT_COMPARISON_FUNCTION,
          atBatParams(query),
        ),
      );
      if (error !== null) throwQueryError('read Daily Nine at-bat comparison', error);
      return measureDecode(() => decodeAtBatSource(data));
    },

    async readCompletedGames(key) {
      const { data, error } = await measureRpc(
        async () => client.rpc(
          COMPLETED_COMPARISON_FUNCTION,
          completedParams(key),
        ),
      );
      if (error !== null) throwQueryError('read Daily Nine completed comparison', error);
      return measureDecode(() => decodeCompletedSource(data));
    },
  };
}

function atBatParams(query: DailyNineAtBatComparisonQuery) {
  return {
    p_puzzle_id: query.puzzleId,
    p_puzzle_date: query.puzzleDate,
    p_puzzle_number: query.puzzleNumber,
    p_ruleset_version: query.rulesetVersion,
    p_pitch_number: query.pitchNumber,
  };
}

function completedParams(key: DailyNineComparisonKey) {
  return {
    p_puzzle_id: key.puzzleId,
    p_puzzle_date: key.puzzleDate,
    p_puzzle_number: key.puzzleNumber,
    p_ruleset_version: key.rulesetVersion,
  };
}

function decodeAtBatSource(value: unknown): DailyNineAtBatComparisonSource {
  const rows = rowArray(value, 'Daily Nine at-bat comparison');
  if (rows.length !== 1) {
    invalid(`Daily Nine at-bat comparison must return exactly one row, received ${rows.length}.`);
  }
  const row = record(rows[0], 'Daily Nine at-bat comparison row');
  return {
    resolvedAtBatCount: nonNegativeSafeInteger(
      row.resolved_at_bat_count,
      'resolved_at_bat_count',
    ),
    awardedPointsSum: safeHalfPoint(
      row.awarded_points_sum,
      'awarded_points_sum',
    ),
  };
}

function decodeCompletedSource(value: unknown): DailyNineCompletedComparisonSource {
  const rows = rowArray(value, 'Daily Nine completed comparison');
  return {
    scoreBuckets: rows.map((candidate, index): DailyNineScoreBucket => {
      const row = record(candidate, `Daily Nine completed comparison row ${index}`);
      return {
        points: safeHalfPoint(row.points, `scoreBuckets[${index}].points`),
        count: positiveSafeInteger(row.result_count, `scoreBuckets[${index}].count`),
      };
    }),
  };
}

function rowArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${field} must return an array.`);
  return value;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function positiveSafeInteger(value: unknown, field: string): number {
  const parsed = nonNegativeSafeInteger(value, field);
  if (parsed === 0) invalid(`${field} must be positive.`);
  return parsed;
}

function safeHalfPoint(value: unknown, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)
    || Math.abs(parsed) > Number.MAX_SAFE_INTEGER
    || !Number.isSafeInteger(parsed * 2)) {
    invalid(`${field} must be a safe half-point value.`);
  }
  return parsed;
}

function safeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    invalid(`${field} must be a safe integer.`);
  }
  return parsed;
}

function nonNegativeSafeInteger(value: unknown, field: string): number {
  const parsed = safeInteger(value, field);
  if (parsed < 0) {
    invalid(`${field} must be a non-negative safe integer.`);
  }
  return parsed;
}

function throwQueryError(operation: string, error: { message: string }): never {
  throw new SupabaseDailyNineComparisonRepositoryError(
    'query',
    `Could not ${operation}: ${error.message}`,
  );
}

function invalid(message: string): never {
  throw new SupabaseDailyNineComparisonRepositoryError('invalid-row', message);
}
