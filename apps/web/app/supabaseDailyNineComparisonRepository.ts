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

const AT_BAT_COMPARISON_FUNCTION = 'daily_nine_at_bat_score_buckets_v2';
const COMPLETED_COMPARISON_FUNCTION = 'daily_nine_completed_score_buckets_v2';

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
    p_excluded_result_id: query.excludedResultId ?? null,
  };
}

function completedParams(key: DailyNineComparisonKey) {
  return {
    p_puzzle_id: key.puzzleId,
    p_puzzle_date: key.puzzleDate,
    p_puzzle_number: key.puzzleNumber,
    p_ruleset_version: key.rulesetVersion,
    p_excluded_result_id: key.excludedResultId ?? null,
  };
}

function decodeAtBatSource(value: unknown): DailyNineAtBatComparisonSource {
  const scoreBuckets = decodeScoreBuckets(value, 'Daily Nine at-bat comparison');
  let resolvedAtBatCount = 0;
  let awardedPointsSum = 0;

  for (const bucket of scoreBuckets) {
    resolvedAtBatCount = nonNegativeSafeInteger(
      resolvedAtBatCount + bucket.count,
      'resolved-at-bat count',
    );
    awardedPointsSum = safeHalfPoint(
      awardedPointsSum + safeHalfPoint(
        bucket.points * bucket.count,
        'score bucket point sum',
      ),
      'awarded-points sum',
    );
  }

  return { resolvedAtBatCount, awardedPointsSum, scoreBuckets };
}

function decodeCompletedSource(value: unknown): DailyNineCompletedComparisonSource {
  return {
    scoreBuckets: decodeScoreBuckets(value, 'Daily Nine completed comparison'),
  };
}

function decodeScoreBuckets(value: unknown, field: string): DailyNineScoreBucket[] {
  return rowArray(value, field).map((candidate, index): DailyNineScoreBucket => {
    const row = record(candidate, `${field} row ${index}`);
    return {
      points: safeHalfPoint(row.points, `scoreBuckets[${index}].points`),
      count: positiveSafeInteger(row.result_count, `scoreBuckets[${index}].count`),
    };
  });
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
