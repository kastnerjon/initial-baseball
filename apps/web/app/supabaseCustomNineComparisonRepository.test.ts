import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDailyNineComparisonService,
  getDailyNineInclusiveAtBatPercentile,
  getDailyNineInclusiveFinishPercentile,
  getDailyNineStrictLowerAtBatRate,
  getDailyNineStrictLowerFinishRate,
} from '@initial-baseball/daily/comparison';
import {
  createSupabaseCustomNineComparisonRepository,
  SupabaseCustomNineComparisonError,
} from './supabaseCustomNineComparisonRepository';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
const KEY = {
  puzzleId: ID, puzzleDate: '1970-01-01', puzzleNumber: 1,
  rulesetVersion: 'points-v4',
} as const;
const row = (points: number | string, count: number | string) => ({ points, result_count: count });

function mockRpc(atBats: unknown, completed: unknown) {
  const rpc = vi.fn(async (method: string, _params: Record<string, unknown>) => ({
    data: method === 'custom_nine_at_bat_score_buckets_v1' ? atBats : completed,
    error: null,
  }));
  const repository = createSupabaseCustomNineComparisonRepository(
    { rpc } as unknown as SupabaseClient, ATTEMPT,
  );
  return { rpc, repository, service: createDailyNineComparisonService(repository) };
}

describe('Custom Nine private score-bucket repository', () => {
  it('keeps exact challenge/slot isolation, trusting only constructor-scoped own ID', async () => {
    const s = mockRpc([row('0.5', '2'), row('1', '1')], [row('24.5', '2'), row('25', '1')]);
    const atBat = await s.service.getAtBat({ ...KEY, pitchNumber: 4 });
    const completed = await s.service.getCompletedGames(KEY);
    expect(s.rpc).toHaveBeenNthCalledWith(1, 'custom_nine_at_bat_score_buckets_v1', {
      p_challenge_id: ID, p_pitch_number: 4, p_excluded_submission_id: ATTEMPT,
    });
    expect(s.rpc).toHaveBeenNthCalledWith(2, 'custom_nine_completed_score_buckets_v1', {
      p_challenge_id: ID, p_excluded_submission_id: ATTEMPT,
    });
    expect(atBat).toMatchObject({ resolvedAtBatCount: 3, averagePoints: 2 / 3 });
    expect(atBat.scoreHistogram?.[1]).toBe(2);
    expect(atBat.scoreHistogram?.[2]).toBe(1);
    expect(getDailyNineStrictLowerAtBatRate({ ...atBat, scoreHistogram: atBat.scoreHistogram! }, 1))
      .toBeCloseTo(2 / 3);
    expect(getDailyNineInclusiveAtBatPercentile({ ...atBat, scoreHistogram: atBat.scoreHistogram! }, 1))
      .toBe(1);
    expect(completed.completedGameCount).toBe(3);
    expect(completed.averageTotalPoints).toBeCloseTo(74 / 3);
    expect(completed.scoreHistogram[49]).toBe(2);
    expect(getDailyNineStrictLowerFinishRate(completed, 24.5)).toBe(0);
    expect(getDailyNineInclusiveFinishPercentile(completed, 24.5)).toBeCloseTo(2 / 3);
  });

  it('preserves zero-peer and one-peer histograms and missing averages', async () => {
    const empty = mockRpc([], []);
    const a = await empty.service.getAtBat({ ...KEY, pitchNumber: 1 });
    const c = await empty.service.getCompletedGames(KEY);
    expect(a).toMatchObject({ resolvedAtBatCount: 0, averagePoints: null });
    expect(c).toMatchObject({ completedGameCount: 0, averageTotalPoints: null });
    expect(a.scoreHistogram?.every(value => value === 0)).toBe(true);
    expect(c.scoreHistogram.every(value => value === 0)).toBe(true);
    expect(getDailyNineStrictLowerFinishRate(c, 20)).toBeNull();

    const single = mockRpc([row('0', '1')], [row('19.5', '1')]);
    expect((await single.service.getAtBat({ ...KEY, pitchNumber: 9 })).resolvedAtBatCount).toBe(1);
    expect((await single.service.getCompletedGames(KEY)).scoreHistogram[39]).toBe(1);
  });

  it('reads independently scoped second challenge without changing exclusion semantics', async () => {
    const s = mockRpc([row('4', '1')], [row('36', '1')]);
    await s.service.getAtBat({ ...KEY, puzzleId: OTHER, pitchNumber: 7 });
    await s.service.getCompletedGames({ ...KEY, puzzleId: OTHER });
    expect(s.rpc.mock.calls.every(([, params]) => params.p_challenge_id === OTHER)).toBe(true);
    expect(s.rpc.mock.calls.every(([, params]) => params.p_excluded_submission_id === ATTEMPT)).toBe(true);
  });

  it('fails closed on alien rulesets, dates, slots or browser-selected exclusion', async () => {
    const s = mockRpc([], []);
    await expect(s.repository.readAtBat({ ...KEY, pitchNumber: 0 })).rejects.toBeInstanceOf(SupabaseCustomNineComparisonError);
    await expect(s.repository.readAtBat({ ...KEY, pitchNumber: 10 })).rejects.toThrow();
    await expect(s.repository.readCompletedGames({ ...KEY, puzzleDate: '2026-10-11' })).rejects.toThrow();
    await expect(s.repository.readCompletedGames({ ...KEY, excludedResultId: ATTEMPT })).rejects.toThrow();
    expect(s.rpc).not.toHaveBeenCalled();
    expect(() => createSupabaseCustomNineComparisonRepository({} as SupabaseClient, 'fake-id')).toThrow();
  });

  it('rejects malformed, unsupported, overlarge or inconsistent buckets', async () => {
    for (const bad of [[row('0.25', '1')], [row('0.5', '0')], [row('NaN', '1')],
      [row('1', '-2')], [{ points: 1, result_count: 1.5 }], null]) {
      const s = mockRpc(bad, []);
      await expect(s.service.getAtBat({ ...KEY, pitchNumber: 1 })).rejects.toThrow();
    }
    const outside = mockRpc([row('5', '1')], [row('37', '1')]);
    await expect(outside.service.getAtBat({ ...KEY, pitchNumber: 1 })).rejects.toThrow();
    await expect(outside.service.getCompletedGames(KEY)).rejects.toThrow();
    const errored = vi.fn().mockResolvedValue({ data: null, error: { message: 'internal secret' } });
    const repository = createSupabaseCustomNineComparisonRepository(
      { rpc: errored } as unknown as SupabaseClient, ATTEMPT,
    );
    await expect(repository.readCompletedGames(KEY)).rejects.toThrow('Private Custom Nine comparison unavailable.');
  });
});
