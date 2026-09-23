import {
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIssuedPuzzle,
} from '@initial-baseball/daily';
import { describe, expect, it } from 'vitest';
import {
  decodePermanentDailyIssuedPuzzleRow,
  encodePermanentDailyIssuedPuzzleRow,
} from './supabasePermanentDailyIssuedPuzzleRowCodec';

const PUZZLE = createPuzzle();

describe('permanent Daily issued-puzzle Supabase row codec', () => {
  it('round-trips the exact immutable puzzle without provider metadata', () => {
    const row = encodePermanentDailyIssuedPuzzleRow(PUZZLE);

    expect(row).not.toHaveProperty('created_at');
    expect(decodePermanentDailyIssuedPuzzleRow(row)).toEqual(PUZZLE);
  });

  it('normalizes equivalent persisted timestamp formatting', () => {
    const row = {
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      issued_at: '2030-04-05T03:00:00-04:00',
    };

    expect(decodePermanentDailyIssuedPuzzleRow(row).issuedAt)
      .toBe('2030-04-05T07:00:00.000Z');
  });

  it('fails closed when persisted puzzle ID disagrees with permanent identity', () => {
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      puzzle_id: 'permanent-v1-daily-99',
    }));
  });

  it('fails closed on malformed or duplicate frozen player IDs', () => {
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      canonical_player_ids: [...PUZZLE.canonicalPlayerIds.slice(0, 8), PUZZLE.canonicalPlayerIds[0]],
    }));
  });

  it('rejects unsupported schema or series versions', () => {
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      schema_version: 2,
    }));
    expectInvalidRow(() => decodePermanentDailyIssuedPuzzleRow({
      ...encodePermanentDailyIssuedPuzzleRow(PUZZLE),
      series_version: 'permanent-v2',
    }));
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

function expectInvalidRow(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ kind: 'invalid-row' });
    return;
  }
  throw new Error('Expected permanent Daily row decoding to fail.');
}
