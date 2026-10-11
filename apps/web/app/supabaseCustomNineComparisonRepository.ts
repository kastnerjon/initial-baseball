import 'server-only';
import {
  validateCustomNinePuzzleId,
  type DailyNineComparisonRepository,
  type DailyNineScoreBucket,
} from '@initial-baseball/daily';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class SupabaseCustomNineComparisonError extends Error {
  constructor(public readonly kind: 'query' | 'invalid-row') {
    super('Private Custom Nine comparison unavailable.');
    this.name = 'SupabaseCustomNineComparisonError';
  }
}

function invalid(): never {
  throw new SupabaseCustomNineComparisonError('invalid-row');
}

function validateKey(key: {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: string;
  excludedResultId?: string;
}, pitchNumber?: number): void {
  try { validateCustomNinePuzzleId(key.puzzleId); }
  catch { invalid(); }
  if (key.puzzleDate !== CUSTOM_NINE_SESSION_DATE || key.puzzleNumber !== 1
    || key.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
    || key.excludedResultId !== undefined
    || (pitchNumber !== undefined && (!Number.isInteger(pitchNumber)
      || pitchNumber < 1 || pitchNumber > 9))) invalid();
}

function parseBuckets(raw: unknown): DailyNineScoreBucket[] {
  if (!Array.isArray(raw)) invalid();
  return raw.map((item: unknown) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) invalid();
    const row = item as Record<string, unknown>;
    const points = typeof row.points === 'number' ? row.points
      : typeof row.points === 'string' && /^-?\d+(?:\.\d+)?$/.test(row.points)
        ? Number(row.points) : NaN;
    const count = typeof row.result_count === 'number' ? row.result_count
      : typeof row.result_count === 'string' && /^\d+$/.test(row.result_count)
        ? Number(row.result_count) : NaN;
    if (!Number.isFinite(points) || !Number.isSafeInteger(points * 2)
      || !Number.isSafeInteger(count) || count <= 0) invalid();
    return { points, count };
  });
}

/**
 * Server-only Custom population adapter. The exclusion ID is provided by
 * the trusted service, never by readAtBat/readCompletedGames request fields.
 * The portable Daily comparison service owns range validation and histogram
 * normalization for the fixed points-v4 ruleset.
 */
export function createSupabaseCustomNineComparisonRepository(
  client: SupabaseClient, trustedAttemptId: string,
): DailyNineComparisonRepository {
  if (!UUID_V4.test(trustedAttemptId)) invalid();

  async function call(functionName: string, params: Record<string, unknown>): Promise<DailyNineScoreBucket[]> {
    let result;
    try { result = await client.rpc(functionName, params); }
    catch { throw new SupabaseCustomNineComparisonError('query'); }
    if (result.error !== null) throw new SupabaseCustomNineComparisonError('query');
    return parseBuckets(result.data);
  }

  return {
    async readAtBat(query) {
      validateKey(query, query.pitchNumber);
      const buckets = await call('custom_nine_at_bat_score_buckets_v1', {
        p_challenge_id: query.puzzleId,
        p_pitch_number: query.pitchNumber,
        p_excluded_submission_id: trustedAttemptId,
      });
      let resolvedAtBatCount = 0;
      let awardedPointsSum = 0;
      for (const bucket of buckets) {
        resolvedAtBatCount += bucket.count;
        awardedPointsSum += bucket.points * bucket.count;
        if (!Number.isSafeInteger(resolvedAtBatCount)
          || !Number.isSafeInteger(awardedPointsSum * 2)) invalid();
      }
      return { resolvedAtBatCount, awardedPointsSum, scoreBuckets: buckets };
    },
    async readCompletedGames(key) {
      validateKey(key);
      return {
        scoreBuckets: await call('custom_nine_completed_score_buckets_v1', {
          p_challenge_id: key.puzzleId,
          p_excluded_submission_id: trustedAttemptId,
        }),
      };
    },
  };
}
