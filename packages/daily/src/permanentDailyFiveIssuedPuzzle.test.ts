import { describe, expect, it } from 'vitest';
import {
  createPermanentDailyFiveIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';
import {
  PERMANENT_DAILY_FIVE_ISSUED_PUZZLE_SCHEMA_VERSION,
  arePermanentDailyFivePuzzlesExactlyEqual,
  clonePermanentDailyFiveIssuedPuzzle,
  createPermanentDailyFiveIssuedPuzzle,
  hasSameImmutablePermanentDailyFiveContent,
  type PermanentDailyFiveIssuedPuzzleInput,
} from './permanentDailyFiveIssuedPuzzle';
import {
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedPuzzle,
} from './permanentDailyIssuedPuzzle';
import {
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';

const FIVE_IDS = Array.from({ length: 5 }, (_, index) => `player-${index + 1}`);
const NINE_IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

function identity(): PermanentDailyIdentity {
  const found = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (found === null) throw new Error('Expected permanent Daily identity.');
  return found;
}

function input(): PermanentDailyFiveIssuedPuzzleInput {
  return {
    identity: identity(),
    canonicalPlayerIds: [...FIVE_IDS],
    issuedAt: '2030-04-05T03:00:00-04:00',
    clueSnapshot: createPermanentDailyFiveIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: FIVE_IDS.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: `P${index + 1}`,
        hintValues: ['2000s', 'NYM', '2B', 'HR 30 / RBI 100'],
      })),
    }),
  };
}

describe('Prospective permanent Daily Five schema-v3 envelope', () => {
  it('freezes exact five-player order, immutable public clues and issued identity', () => {
    const source = input();
    const puzzle = createPermanentDailyFiveIssuedPuzzle(source);

    expect(puzzle).toMatchObject({
      schemaVersion: PERMANENT_DAILY_FIVE_ISSUED_PUZZLE_SCHEMA_VERSION,
      puzzleId: 'permanent-v1-daily-1',
      identity: identity(),
      canonicalPlayerIds: FIVE_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
      clueSnapshot: { schemaVersion: 1 },
    });
    expect(puzzle.clueSnapshot.pitches).toHaveLength(5);
    expect(puzzle.clueSnapshot.hintLayout).toHaveLength(4);
    expect(puzzle.clueSnapshot.pitches.every(pitch => pitch.hintValues.length === 4)).toBe(true);

    (source.canonicalPlayerIds as string[])[0] = 'changed';
    (source.clueSnapshot.pitches[0]!.hintValues as string[])[0] = 'changed';
    expect(puzzle.canonicalPlayerIds[0]).toBe(FIVE_IDS[0]);
    expect(puzzle.clueSnapshot.pitches[0]!.hintValues[0]).toBe('2000s');

    const clone = clonePermanentDailyFiveIssuedPuzzle(puzzle);
    expect(clone).toEqual(puzzle);
    expect(clone).not.toBe(puzzle);
    expect(clone.canonicalPlayerIds).not.toBe(puzzle.canonicalPlayerIds);
    expect(clone.clueSnapshot).not.toBe(puzzle.clueSnapshot);
    expect(clone.clueSnapshot.pitches[0]!.hintValues)
      .not.toBe(puzzle.clueSnapshot.pitches[0]!.hintValues);
  });

  it('rejects wrong lengths, duplicates, missing identities and out-of-order clue snapshots', () => {
    const basic = input();
    for (const canonicalPlayerIds of [FIVE_IDS.slice(0, 4), NINE_IDS]) {
      expect(() => createPermanentDailyFiveIssuedPuzzle({
        ...basic, canonicalPlayerIds,
      })).toThrow('exactly 5 players');
    }
    expect(() => createPermanentDailyFiveIssuedPuzzle({
      ...basic, canonicalPlayerIds: [...FIVE_IDS.slice(0, 4), FIVE_IDS[0]!],
    })).toThrow('Duplicate permanent Daily canonical player');
    expect(() => createPermanentDailyFiveIssuedPuzzle({
      ...basic, canonicalPlayerIds: [...FIVE_IDS.slice(0, 4), '  '],
    })).toThrow('canonical player ID is required');

    const badClues = {
      ...basic.clueSnapshot,
      pitches: basic.clueSnapshot.pitches.map((pitch, i) => i === 2
        ? { ...pitch, canonicalPlayerId: 'other-player' } : pitch),
    };
    expect(() => createPermanentDailyFiveIssuedPuzzle({
      ...basic, clueSnapshot: badClues,
    })).toThrow('does not match frozen batting order');
  });

  it('rejects altered snapshot values, wrong series, malformed issue time or puzzle ID', () => {
    const basic = input();
    expect(() => createPermanentDailyFiveIssuedPuzzle({
      ...basic,
      identity: { ...basic.identity, seriesVersion: 'archive-beta-v1' } as unknown as PermanentDailyIdentity,
    })).toThrow('Unsupported Permanent Daily series version');
    expect(() => createPermanentDailyFiveIssuedPuzzle({
      ...basic, issuedAt: 'not-a-date',
    })).toThrow('Invalid permanent Daily issued timestamp');
    expect(() => createPermanentDailyFiveIssuedPuzzle({
      ...basic,
      clueSnapshot: {
        ...basic.clueSnapshot,
        pitches: basic.clueSnapshot.pitches.map((pitch, i) => i === 0
          ? { ...pitch, hintValues: ['a', 'b', 'c', ''] } : pitch),
      },
    })).toThrow('pitch 1 hint 4 value is required');

    const puzzle = createPermanentDailyFiveIssuedPuzzle(basic);
    expect(() => clonePermanentDailyFiveIssuedPuzzle({
      ...puzzle, puzzleId: 'permanent-v1-daily-999',
    })).toThrow('identity does not match puzzle ID');
    expect(() => clonePermanentDailyFiveIssuedPuzzle({
      ...puzzle, schemaVersion: 2 as 3,
    })).toThrow('Expected schema-v3 permanent Daily Five');
  });

  it('distinguishes immutable retries, changed clues, and issue timestamps', () => {
    const first = createPermanentDailyFiveIssuedPuzzle(input());
    const reissued = createPermanentDailyFiveIssuedPuzzle({
      ...input(), issuedAt: '2030-04-05T08:00:00.000Z',
    });
    expect(hasSameImmutablePermanentDailyFiveContent(first, reissued)).toBe(true);
    expect(arePermanentDailyFivePuzzlesExactlyEqual(first, reissued)).toBe(false);

    const changed = createPermanentDailyFiveIssuedPuzzle({
      ...input(),
      clueSnapshot: {
        ...input().clueSnapshot,
        pitches: input().clueSnapshot.pitches.map((pitch, index) => index === 1
          ? { ...pitch, initials: 'ZX' } : pitch),
      },
    });
    expect(hasSameImmutablePermanentDailyFiveContent(first, changed)).toBe(false);
  });

  it('keeps legacy v1/v2 constructors nine-only, not implicitly schema-v3', () => {
    const future = input();
    expect(() => createPermanentDailyIssuedPuzzle(future)).toThrow('exactly 9 players');
    expect(() => createPermanentDailyClueFrozenIssuedPuzzle(future))
      .toThrow('exactly 9 players');
  });
});
