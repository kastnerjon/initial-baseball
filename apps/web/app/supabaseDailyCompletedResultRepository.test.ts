import type { DailyCompletedResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createSupabaseDailyCompletedResultRepository,
} from './supabaseDailyCompletedResultRepository';

const RESULT: DailyCompletedResult = {
  schemaVersion: 1,
  submissionId: 'submission-1',
  puzzleId: 'daily-2026-09-17-editorial-v1',
  puzzleDate: '2026-09-17',
  puzzleNumber: 144,
  rulesetVersion: 'points-v3',
  completedAtBats: Array.from({ length: 9 }, (_, index) => ({
    pitchNumber: index + 1,
    initials: `P${index + 1}`,
    outcome: 'HR' as const,
    hintsRevealed: 0 as const,
    wrongGuesses: 0,
    resolution: 'correct' as const,
  })),
  summary: {
    points: 63,
    maximumPoints: 63,
    atBatsCompleted: 9,
    totalAtBats: 9,
    completed: true,
    strikeouts: 0,
  },
};

const V4_RESULT: DailyCompletedResult = {
  ...RESULT,
  submissionId: 'submission-v4-1',
  rulesetVersion: 'points-v4',
  completedAtBats: RESULT.completedAtBats.map(atBat => ({
    ...atBat,
    outcome: 'BB',
    hintsRevealed: 4,
    wrongGuesses: 2,
    resolution: 'correct',
  })),
  summary: {
    points: 4.5,
    maximumPoints: 36,
    atBatsCompleted: 9,
    totalAtBats: 9,
    completed: true,
    strikeouts: 0,
  },
};

describe('Supabase completed-result repository', () => {
  it('inserts the complete normalized result without an update or upsert path', async () => {
    const single = vi.fn().mockResolvedValue({ data: toRow(RESULT), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const stored = await createSupabaseDailyCompletedResultRepository(asClient(from))
      .insertIfAbsent(RESULT);

    expect(stored).toEqual({ status: 'inserted', result: RESULT });
    expect(from).toHaveBeenCalledWith('daily_completed_results');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      submission_id: RESULT.submissionId,
      puzzle_id: RESULT.puzzleId,
      ruleset_version: RESULT.rulesetVersion,
      completed_at_bats: RESULT.completedAtBats,
      summary: RESULT.summary,
    }));
  });

  it('round-trips a fractional points-v4 result through the same immutable provider path', async () => {
    const single = vi.fn().mockResolvedValue({ data: toRow(V4_RESULT), error: null });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });
    const from = vi.fn().mockReturnValue({ insert });

    const stored = await createSupabaseDailyCompletedResultRepository(asClient(from))
      .insertIfAbsent(V4_RESULT);

    expect(stored).toEqual({ status: 'inserted', result: V4_RESULT });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      ruleset_version: 'points-v4',
      summary: V4_RESULT.summary,
    }));
  });

  it('reads the existing winner only after an atomic unique-key conflict', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: toRow(RESULT), error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const readSelect = vi.fn().mockReturnValue({ eq });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ select: readSelect });

    const stored = await createSupabaseDailyCompletedResultRepository(asClient(from))
      .insertIfAbsent(RESULT);

    expect(stored).toEqual({ status: 'existing', result: RESULT });
    expect(from).toHaveBeenCalledTimes(2);
    expect(eq).toHaveBeenCalledWith('submission_id', RESULT.submissionId);
  });

  it('fails closed if the existing winner is malformed', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });

    const malformed = { ...toRow(RESULT), summary: { points: '63' } };
    const maybeSingle = vi.fn().mockResolvedValue({ data: malformed, error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      });

    await expect(
      createSupabaseDailyCompletedResultRepository(asClient(from)).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('maps non-unique provider failures to a query error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });

    await expect(
      createSupabaseDailyCompletedResultRepository(
        asClient(vi.fn().mockReturnValue({ insert })),
      ).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({
      kind: 'query',
      message: expect.stringContaining('connection failure'),
    });
  });

  it('treats a unique conflict with no readable winner as a provider invariant failure', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      });

    await expect(
      createSupabaseDailyCompletedResultRepository(asClient(from)).insertIfAbsent(RESULT),
    ).rejects.toMatchObject({ kind: 'query' });
  });
});

function toRow(result: DailyCompletedResult): Record<string, unknown> {
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

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
