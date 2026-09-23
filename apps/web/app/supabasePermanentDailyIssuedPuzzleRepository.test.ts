import {
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIssuedPuzzle,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createSupabasePermanentDailyIssuedPuzzleRepository,
} from './supabasePermanentDailyIssuedPuzzleRepository';

const PUZZLE = createPuzzle();

describe('Supabase permanent Daily issued-puzzle repository', () => {
  it('inserts the immutable puzzle without an update or upsert path', async () => {
    const single = vi.fn().mockResolvedValue({ data: toRow(PUZZLE), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const stored = await createSupabasePermanentDailyIssuedPuzzleRepository(asClient(from))
      .insertIfAbsent(PUZZLE);

    expect(stored).toEqual({ status: 'inserted', puzzle: PUZZLE });
    expect(from).toHaveBeenCalledWith('permanent_daily_issued_puzzles');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      series_version: 'permanent-v1',
      daily_number: 1,
      puzzle_id: 'permanent-v1-daily-1',
      canonical_player_ids: PUZZLE.canonicalPlayerIds,
    }));
  });

  it('reads the existing immutable winner after a unique-key conflict', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: toRow(PUZZLE), error: null });
    const match = vi.fn().mockReturnValue({ maybeSingle });
    const readSelect = vi.fn().mockReturnValue({ match });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({ select: readSelect });

    const stored = await createSupabasePermanentDailyIssuedPuzzleRepository(asClient(from))
      .insertIfAbsent(PUZZLE);

    expect(stored).toEqual({ status: 'existing', puzzle: PUZZLE });
    expect(match).toHaveBeenCalledWith({
      series_version: 'permanent-v1',
      daily_number: 1,
    });
  });

  it('fails closed when a unique conflict has no readable row for the requested identity', async () => {
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
          match: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      });

    await expect(
      createSupabasePermanentDailyIssuedPuzzleRepository(asClient(from)).insertIfAbsent(PUZZLE),
    ).rejects.toMatchObject({ kind: 'query' });
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
      createSupabasePermanentDailyIssuedPuzzleRepository(
        asClient(vi.fn().mockReturnValue({ insert })),
      ).insertIfAbsent(PUZZLE),
    ).rejects.toMatchObject({
      kind: 'query',
      message: expect.stringContaining('connection failure'),
    });
  });
});

function createPuzzle(): PermanentDailyIssuedPuzzle {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');

  return createPermanentDailyIssuedPuzzle({
    identity,
    canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `player-${index + 1}`),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}

function toRow(puzzle: PermanentDailyIssuedPuzzle): Record<string, unknown> {
  return {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
    puzzle_date: puzzle.identity.puzzleDate,
    schema_version: puzzle.schemaVersion,
    puzzle_id: puzzle.puzzleId,
    canonical_player_ids: [...puzzle.canonicalPlayerIds],
    issued_at: puzzle.issuedAt,
  };
}

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
