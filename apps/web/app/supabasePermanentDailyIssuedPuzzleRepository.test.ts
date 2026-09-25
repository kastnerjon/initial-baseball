import {
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedClueSnapshot,
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRecord,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createSupabasePermanentDailyIssuedPuzzleReadRepository,
  createSupabasePermanentDailyIssuedPuzzleRepository,
} from './supabasePermanentDailyIssuedPuzzleRepository';

const PUZZLE = createPuzzle();
const V2_PUZZLE = createV2Puzzle();

describe('Supabase permanent Daily issued-puzzle repository', () => {
  it('inserts v1 without update/upsert behavior', async () => {
    const single = vi.fn().mockResolvedValue({ data: toRow(PUZZLE), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const stored = await createSupabasePermanentDailyIssuedPuzzleRepository(asClient(from))
      .insertIfAbsent(PUZZLE);

    expect(stored).toEqual({ status: 'inserted', puzzle: PUZZLE });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      schema_version: 1,
      canonical_player_ids: PUZZLE.canonicalPlayerIds,
      clue_snapshot: null,
    }));
  });

  it('inserts and decodes one clue-frozen v2 record', async () => {
    const single = vi.fn().mockResolvedValue({ data: toRow(V2_PUZZLE), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    const stored = await createSupabasePermanentDailyIssuedPuzzleRepository(
      asClient(vi.fn().mockReturnValue({ insert })),
    ).insertIfAbsent(V2_PUZZLE);

    expect(stored).toEqual({ status: 'inserted', puzzle: V2_PUZZLE });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      schema_version: 2,
      clue_snapshot: V2_PUZZLE.clueSnapshot,
    }));
  });

  it('reads the first immutable winner after a unique conflict', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSingle }),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: toRow(V2_PUZZLE), error: null });
    const match = vi.fn().mockReturnValue({ maybeSingle });
    const from = vi.fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ match }),
      });

    const stored = await createSupabasePermanentDailyIssuedPuzzleRepository(asClient(from))
      .insertIfAbsent(V2_PUZZLE);

    expect(stored).toEqual({ status: 'existing', puzzle: V2_PUZZLE });
    expect(match).toHaveBeenCalledWith({
      series_version: 'permanent-v1',
      daily_number: 1,
    });
  });

  it('fails closed when a unique conflict has no readable identity winner', async () => {
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

  it('maps non-unique provider failures to the existing query error', async () => {
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

describe('Supabase permanent Daily issued-puzzle reads', () => {
  it('reads v1 by number and v2 by date through the same codec', async () => {
    const byNumber = createReadClient(toRow(PUZZLE));
    await expect(
      createSupabasePermanentDailyIssuedPuzzleReadRepository(byNumber.client)
        .getByNumber({ seriesVersion: 'permanent-v1', dailyNumber: 1 }),
    ).resolves.toEqual(PUZZLE);

    const byDate = createReadClient(toRow(V2_PUZZLE));
    await expect(
      createSupabasePermanentDailyIssuedPuzzleReadRepository(byDate.client)
        .getByDate({ seriesVersion: 'permanent-v1', puzzleDate: '2030-04-05' }),
    ).resolves.toEqual(V2_PUZZLE);
  });

  it('returns null for missing rows and fails closed on malformed rows', async () => {
    const missing = createReadClient(null);
    await expect(
      createSupabasePermanentDailyIssuedPuzzleReadRepository(missing.client)
        .getByNumber({ seriesVersion: 'permanent-v1', dailyNumber: 2 }),
    ).resolves.toBeNull();

    const malformed = toRow(V2_PUZZLE);
    malformed.clue_snapshot = null;
    const invalid = createReadClient(malformed);
    await expect(
      createSupabasePermanentDailyIssuedPuzzleReadRepository(invalid.client)
        .getByNumber({ seriesVersion: 'permanent-v1', dailyNumber: 1 }),
    ).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('maps read-provider failures to the existing query error type', async () => {
    const failed = createReadClient(null, {
      code: '08006',
      message: 'connection failure',
    });

    await expect(
      createSupabasePermanentDailyIssuedPuzzleReadRepository(failed.client)
        .getByDate({ seriesVersion: 'permanent-v1', puzzleDate: '2030-04-05' }),
    ).rejects.toMatchObject({
      kind: 'query',
      message: expect.stringContaining('connection failure'),
    });
  });
});

function createReadClient(
  data: Record<string, unknown> | null,
  error: { code: string; message: string } | null = null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const match = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ match });
  const from = vi.fn().mockReturnValue({ select });

  return { client: asClient(from), match };
}

function createPuzzle(): PermanentDailyIssuedPuzzle {
  return createPermanentDailyIssuedPuzzle({
    identity: requireIdentity(),
    canonicalPlayerIds: playerIds(),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}

function createV2Puzzle() {
  const canonicalPlayerIds = playerIds();
  return createPermanentDailyClueFrozenIssuedPuzzle({
    identity: requireIdentity(),
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
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}

function requireIdentity() {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');
  return identity;
}

function playerIds() {
  return Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
}

function toRow(puzzle: PermanentDailyIssuedPuzzleRecord): Record<string, unknown> {
  return {
    series_version: puzzle.identity.seriesVersion,
    daily_number: puzzle.identity.dailyNumber,
    puzzle_date: puzzle.identity.puzzleDate,
    schema_version: puzzle.schemaVersion,
    puzzle_id: puzzle.puzzleId,
    canonical_player_ids: [...puzzle.canonicalPlayerIds],
    clue_snapshot: puzzle.schemaVersion === 2
      ? {
          schemaVersion: puzzle.clueSnapshot.schemaVersion,
          hintLayout: puzzle.clueSnapshot.hintLayout.map(slot => ({ ...slot })),
          pitches: puzzle.clueSnapshot.pitches.map(pitch => ({
            ...pitch,
            hintValues: [...pitch.hintValues],
          })),
        }
      : null,
    issued_at: puzzle.issuedAt,
  };
}

function asClient(from: ReturnType<typeof vi.fn>): SupabaseClient {
  return { from } as unknown as SupabaseClient;
}
