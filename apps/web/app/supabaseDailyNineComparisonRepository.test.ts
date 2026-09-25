import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createSupabaseDailyNineComparisonRepository } from './supabaseDailyNineComparisonRepository';

const KEY = {
  puzzleId: 'daily-2026-09-18-editorial-f5f968b7',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

const V4_KEY = {
  ...KEY,
  rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
} as const;

describe('Supabase Daily Nine comparison repository', () => {
  it('reads one exact at-bat population as count plus stored point sum', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ resolved_at_bat_count: '4', awarded_points_sum: '17' }],
      error: null,
    });
    const repository = createSupabaseDailyNineComparisonRepository(asClient(rpc));

    await expect(repository.readAtBat({ ...KEY, pitchNumber: 7 })).resolves.toEqual({
      resolvedAtBatCount: 4,
      awardedPointsSum: 17,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('daily_nine_at_bat_comparison', {
      p_puzzle_id: KEY.puzzleId,
      p_puzzle_date: KEY.puzzleDate,
      p_puzzle_number: KEY.puzzleNumber,
      p_ruleset_version: KEY.rulesetVersion,
      p_pitch_number: 7,
    });
  });

  it('decodes a signed points-v4 at-bat aggregate', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ resolved_at_bat_count: '3', awarded_points_sum: '-2' }],
      error: null,
    });
    const repository = createSupabaseDailyNineComparisonRepository(asClient(rpc));

    await expect(repository.readAtBat({ ...V4_KEY, pitchNumber: 2 })).resolves.toEqual({
      resolvedAtBatCount: 3,
      awardedPointsSum: -2,
    });
    expect(rpc).toHaveBeenCalledWith('daily_nine_at_bat_comparison', {
      p_puzzle_id: V4_KEY.puzzleId,
      p_puzzle_date: V4_KEY.puzzleDate,
      p_puzzle_number: V4_KEY.puzzleNumber,
      p_ruleset_version: V4_KEY.rulesetVersion,
      p_pitch_number: 2,
    });
  });

  it('preserves an empty at-bat aggregate as zero count and zero sum', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ resolved_at_bat_count: 0, awarded_points_sum: 0 }],
      error: null,
    });

    await expect(
      createSupabaseDailyNineComparisonRepository(asClient(rpc))
        .readAtBat({ ...KEY, pitchNumber: 1 }),
    ).resolves.toEqual({
      resolvedAtBatCount: 0,
      awardedPointsSum: 0,
    });
  });

  it('fails closed when an at-bat RPC does not return exactly one valid row', async () => {
    const missing = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({ data: [], error: null }),
    ));
    await expect(missing.readAtBat({ ...KEY, pitchNumber: 1 }))
      .rejects.toMatchObject({ kind: 'invalid-row' });

    const malformed = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({
        data: [{ resolved_at_bat_count: 2, awarded_points_sum: 'not-an-int' }],
        error: null,
      }),
    ));
    await expect(malformed.readAtBat({ ...KEY, pitchNumber: 1 }))
      .rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('reads completed score buckets without fetching raw completed rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { points: 0, result_count: '2' },
        { points: 31, result_count: 3 },
        { points: 63, result_count: '1' },
      ],
      error: null,
    });
    const repository = createSupabaseDailyNineComparisonRepository(asClient(rpc));

    await expect(repository.readCompletedGames(KEY)).resolves.toEqual({
      scoreBuckets: [
        { points: 0, count: 2 },
        { points: 31, count: 3 },
        { points: 63, count: 1 },
      ],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('daily_nine_completed_score_buckets', {
      p_puzzle_id: KEY.puzzleId,
      p_puzzle_date: KEY.puzzleDate,
      p_puzzle_number: KEY.puzzleNumber,
      p_ruleset_version: KEY.rulesetVersion,
    });
  });

  it('decodes signed points-v4 completed score buckets', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { points: '-9', result_count: '2' },
        { points: '-1', result_count: 3 },
        { points: 36, result_count: '1' },
      ],
      error: null,
    });
    const repository = createSupabaseDailyNineComparisonRepository(asClient(rpc));

    await expect(repository.readCompletedGames(V4_KEY)).resolves.toEqual({
      scoreBuckets: [
        { points: -9, count: 2 },
        { points: -1, count: 3 },
        { points: 36, count: 1 },
      ],
    });
    expect(rpc).toHaveBeenCalledWith('daily_nine_completed_score_buckets', {
      p_puzzle_id: V4_KEY.puzzleId,
      p_puzzle_date: V4_KEY.puzzleDate,
      p_puzzle_number: V4_KEY.puzzleNumber,
      p_ruleset_version: V4_KEY.rulesetVersion,
    });
  });

  it('returns an empty completed population without inventing a score bucket', async () => {
    const repository = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({ data: [], error: null }),
    ));

    await expect(repository.readCompletedGames(KEY)).resolves.toEqual({ scoreBuckets: [] });
  });

  it('fails closed on malformed completed aggregate rows', async () => {
    const zeroCount = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({
        data: [{ points: 20, result_count: 0 }],
        error: null,
      }),
    ));
    await expect(zeroCount.readCompletedGames(KEY))
      .rejects.toMatchObject({ kind: 'invalid-row' });

    const unsafeCount = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({
        data: [{ points: 20, result_count: '9007199254740992' }],
        error: null,
      }),
    ));
    await expect(unsafeCount.readCompletedGames(KEY))
      .rejects.toMatchObject({ kind: 'invalid-row' });

    const nullPoints = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({
        data: [{ points: null, result_count: 1 }],
        error: null,
      }),
    ));
    await expect(nullPoints.readCompletedGames(KEY))
      .rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('records RPC wait and local decode as separate provider sub-stages', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ resolved_at_bat_count: 2, awarded_points_sum: 9 }],
      error: null,
    });
    const timings = {};
    const repository = createSupabaseDailyNineComparisonRepository(asClient(rpc), {
      timings,
      now: clock([100, 145, 200, 203]),
    });

    await expect(repository.readAtBat({ ...KEY, pitchNumber: 2 })).resolves.toEqual({
      resolvedAtBatCount: 2,
      awardedPointsSum: 9,
    });

    expect(timings).toEqual({
      'provider-rpc': 45,
      'provider-decode': 3,
    });
  });

  it('records RPC wait without inventing decode time when the RPC returns an error', async () => {
    const timings = {};
    const repository = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({ data: null, error: { message: 'provider failure' } }),
    ), {
      timings,
      now: clock([10, 88]),
    });

    await expect(repository.readCompletedGames(KEY)).rejects.toMatchObject({
      kind: 'query',
    });
    expect(timings).toEqual({
      'provider-rpc': 78,
    });
  });

  it('maps provider failures to query errors for each independent read', async () => {
    const atBat = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({ data: null, error: { message: 'at-bat failure' } }),
    ));
    await expect(atBat.readAtBat({ ...KEY, pitchNumber: 3 })).rejects.toMatchObject({
      kind: 'query',
      message: expect.stringContaining('at-bat failure'),
    });

    const completed = createSupabaseDailyNineComparisonRepository(asClient(
      vi.fn().mockResolvedValue({ data: null, error: { message: 'completed failure' } }),
    ));
    await expect(completed.readCompletedGames(KEY)).rejects.toMatchObject({
      kind: 'query',
      message: expect.stringContaining('completed failure'),
    });
  });
});

function asClient(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

function clock(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) throw new Error('Test clock exhausted.');
    index += 1;
    return value;
  };
}

