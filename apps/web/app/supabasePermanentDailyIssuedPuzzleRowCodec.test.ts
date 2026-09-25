import {
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedClueSnapshot,
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyClueFrozenIssuedPuzzle,
  type PermanentDailyIssuedPuzzle,
} from '@initial-baseball/daily';
import { describe, expect, it } from 'vitest';
import {
  decodePermanentDailyIssuedPuzzleRow,
  encodePermanentDailyIssuedPuzzleRow,
} from './supabasePermanentDailyIssuedPuzzleRowCodec';

const PUZZLE = createPuzzle();
const CLUE_FROZEN_PUZZLE = createClueFrozenPuzzle();

describe('permanent Daily issued-puzzle Supabase row codec', () => {
  it('round-trips schema v1 with no clue snapshot', () => {
    const row = encodePermanentDailyIssuedPuzzleRow(PUZZLE);

    expect(row).not.toHaveProperty('created_at');
    expect(row.clue_snapshot).toBeNull();
    expect(decodePermanentDailyIssuedPuzzleRow(row)).toEqual(PUZZLE);
  });

  it('round-trips schema v2 with a defensive clue snapshot', () => {
    const row = encodePermanentDailyIssuedPuzzleRow(CLUE_FROZEN_PUZZLE);

    expect(row.clue_snapshot).toEqual(CLUE_FROZEN_PUZZLE.clueSnapshot);
    expect(row.clue_snapshot).not.toBe(CLUE_FROZEN_PUZZLE.clueSnapshot);

    const decoded = decodePermanentDailyIssuedPuzzleRow(row);
    expect(decoded).toEqual(CLUE_FROZEN_PUZZLE);
    if (decoded.schemaVersion !== 2) throw new Error('Expected schema-v2 puzzle.');
    expect(decoded.clueSnapshot).not.toBe(CLUE_FROZEN_PUZZLE.clueSnapshot);
    expect(decoded.clueSnapshot.pitches[0]?.hintValues)
      .not.toBe(CLUE_FROZEN_PUZZLE.clueSnapshot.pitches[0]?.hintValues);
  });

  it('keeps pre-v2 schema-v1 rows backward-readable when clue_snapshot is absent', () => {
    const row = encodePermanentDailyIssuedPuzzleRow(PUZZLE) as Record<string, unknown>;
    delete row.clue_snapshot;

    expect(decodePermanentDailyIssuedPuzzleRow(row)).toEqual(PUZZLE);
  });

  it('requires clue_snapshot for v2 and forbids it on v1', () => {
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(CLUE_FROZEN_PUZZLE),
      clue_snapshot: null,
    }));
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      clue_snapshot: CLUE_FROZEN_PUZZLE.clueSnapshot,
    }));
  });

  it('fails closed on malformed clue snapshots or clue/player order drift', () => {
    const row = encodePermanentDailyIssuedPuzzleRow(CLUE_FROZEN_PUZZLE);
    const clueSnapshot = row.clue_snapshot as {
      schemaVersion: number;
      hintLayout: unknown[];
      pitches: Array<Record<string, unknown>>;
    };

    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...row,
      clue_snapshot: {
        ...clueSnapshot,
        pitches: clueSnapshot.pitches.slice(0, 8),
      },
    }));

    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...row,
      clue_snapshot: {
        ...clueSnapshot,
        pitches: clueSnapshot.pitches.map((pitch, index) => (
          index === 0
            ? { ...pitch, canonicalPlayerId: 'different-player' }
            : pitch
        )),
      },
    }));
  });

  it('normalizes timestamps and rejects identity/schema drift', () => {
    const normalized = decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      issued_at: '2030-04-05T03:00:00-04:00',
    });
    expect(normalized.issuedAt).toBe('2030-04-05T07:00:00.000Z');

    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      puzzle_id: 'permanent-v1-daily-99',
    }));
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      canonical_player_ids: [...PUZZLE.canonicalPlayerIds.slice(0, 8), PUZZLE.canonicalPlayerIds[0]],
    }));
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      schema_version: 3,
    }));
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      series_version: 'permanent-v2',
    }));
  });
});

function createPuzzle(): PermanentDailyIssuedPuzzle {
  return createPermanentDailyIssuedPuzzle({
    identity: requireIdentity(),
    canonicalPlayerIds: playerIds(),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}

function createClueFrozenPuzzle(): PermanentDailyClueFrozenIssuedPuzzle {
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

function expectInvalidRow(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ kind: 'invalid-row' });
    return;
  }
  throw new Error('Expected permanent Daily row decoding to fail.');
}
