import {
  createArchiveBetaDailyClueFrozenIssuedPuzzle,
  createArchiveBetaDailyEpoch,
  createPermanentDailyIssuedClueSnapshot,
  resolveArchiveBetaDailyIdentityForDate,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository,
  createSupabaseArchiveBetaDailyIssuedPuzzleRepository,
} from './supabasePermanentDailyIssuedPuzzleRepository';
import {
  decodeArchiveBetaDailyIssuedPuzzleRow,
  encodeArchiveBetaDailyIssuedPuzzleRow,
} from './supabasePermanentDailyIssuedPuzzleRowCodec';

const PUZZLE = createPuzzle();

describe('archive beta issued-puzzle Supabase row codec', () => {
  it('round-trips one defensive schema-v2 beta row', () => {
    const row = encodeArchiveBetaDailyIssuedPuzzleRow(PUZZLE);
    const decoded = decodeArchiveBetaDailyIssuedPuzzleRow(row);

    expect(row).toMatchObject({
      series_version: 'archive-beta-v1',
      schema_version: 2,
      puzzle_id: 'archive-beta-v1-daily-1',
    });
    expect(decoded).toEqual(PUZZLE);
    expect(decoded.clueSnapshot).not.toBe(PUZZLE.clueSnapshot);
  });

  it('rejects beta schema-v1, wrong-series, wrong-id, and missing-clue rows', () => {
    const row = encodeArchiveBetaDailyIssuedPuzzleRow(PUZZLE);

    expectInvalid(() => decodeArchiveBetaDailyIssuedPuzzleRow({
      ...row,
      schema_version: 1,
      clue_snapshot: null,
    }));
    expectInvalid(() => decodeArchiveBetaDailyIssuedPuzzleRow({
      ...row,
      series_version: 'permanent-v1',
    }));
    expectInvalid(() => decodeArchiveBetaDailyIssuedPuzzleRow({
      ...row,
      puzzle_id: 'archive-beta-v1-daily-99',
    }));
    expectInvalid(() => decodeArchiveBetaDailyIssuedPuzzleRow({
      ...row,
      clue_snapshot: null,
    }));
  });
});

describe('Supabase archive beta issued-puzzle repository', () => {
  it('inserts schema v2 with plain INSERT and decodes the returned row', async () => {
    const single = vi.fn().mockResolvedValue({
      data: encodeArchiveBetaDailyIssuedPuzzleRow(PUZZLE),
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    const stored = await createSupabaseArchiveBetaDailyIssuedPuzzleRepository(
      asClient(vi.fn().mockReturnValue({ insert })),
    ).insertIfAbsent(PUZZLE);

    expect(stored).toEqual({ status: 'inserted', puzzle: PUZZLE });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      series_version: 'archive-beta-v1',
      schema_version: 2,
      puzzle_id: 'archive-beta-v1-daily-1',
    }));
  });

  it('reads the immutable beta winner after a unique conflict by exact series+number', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: encodeArchiveBetaDailyIssuedPuzzleRow(PUZZLE),
      error: null,
    });
    const match = vi.fn().mockReturnValue({ maybeSingle });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ match }),
      });

    const stored = await createSupabaseArchiveBetaDailyIssuedPuzzleRepository(
      asClient(from),
    ).insertIfAbsent(PUZZLE);

    expect(stored).toEqual({ status: 'existing', puzzle: PUZZLE });
    expect(match).toHaveBeenCalledWith({
      series_version: 'archive-beta-v1',
      daily_number: 1,
    });
  });

  it('reads beta rows by number/date and returns null for missing rows', async () => {
    const byNumber = createReadClient(encodeArchiveBetaDailyIssuedPuzzleRow(PUZZLE));
    await expect(
      createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(byNumber.client)
        .getByNumber({ seriesVersion: 'archive-beta-v1', dailyNumber: 1 }),
    ).resolves.toEqual(PUZZLE);

    const byDate = createReadClient(encodeArchiveBetaDailyIssuedPuzzleRow(PUZZLE));
    await expect(
      createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(byDate.client)
        .getByDate({ seriesVersion: 'archive-beta-v1', puzzleDate: '2026-09-29' }),
    ).resolves.toEqual(PUZZLE);

    await expect(
      createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(createReadClient(null).client)
        .getByNumber({ seriesVersion: 'archive-beta-v1', dailyNumber: 2 }),
    ).resolves.toBeNull();
  });
});

function createPuzzle(): ArchiveBetaDailyClueFrozenIssuedPuzzle {
  const identity = resolveArchiveBetaDailyIdentityForDate(
    '2026-09-29',
    createArchiveBetaDailyEpoch('2026-09-29'),
  );
  if (identity === null) throw new Error('Expected archive beta identity.');

  const canonicalPlayerIds = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
  return createArchiveBetaDailyClueFrozenIssuedPuzzle({
    identity,
    canonicalPlayerIds,
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: canonicalPlayerIds.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: `P${index + 1}`,
        hintValues: ['2000s', 'SEA, CIN', index === 8 ? 'P' : 'CF', 'Career stats'],
      })),
    }),
    issuedAt: '2026-09-29T07:00:00.000Z',
  });
}

function createReadClient(data: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const match = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ match });
  return {
    client: asClient(vi.fn().mockReturnValue({ select })),
    match,
  };
}

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}

function expectInvalid(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ kind: 'invalid-row' });
    return;
  }
  throw new Error('Expected archive beta row decoding to fail.');
}
