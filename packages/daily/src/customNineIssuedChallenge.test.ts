import { describe, expect, it } from 'vitest';
import {
  cloneCustomNineIssuedChallenge,
  createCustomNineIssuedChallenge,
  validateCustomNinePuzzleId,
} from './customNineIssuedChallenge';
import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import type { CustomNineIssuedChallengeInput } from './customNineIssuedChallenge';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const IDS = Array.from({ length: 9 }, (_, index) => 'player-' + (index + 1));

function fixture(): CustomNineIssuedChallengeInput {
  return {
    puzzleId: ID,
    canonicalPlayerIds: [...IDS],
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: IDS.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: 'P' + (index + 1),
        hintValues: ['2000s', 'Mets', 'SS', 'HR 123'],
      })),
    }),
    issuedAt: '2026-10-08T23:45:00-04:00',
  };
}

describe('Custom Nine private immutable challenge', () => {
  it('validates identity, locks points-v4, and preserves canonical order plus issued clues', () => {
    const record = createCustomNineIssuedChallenge(fixture());
    expect(record.puzzleId).toBe(ID);
    expect(record.schemaVersion).toBe(1);
    expect(record.rulesetVersion).toBe('points-v4');
    expect(record.canonicalPlayerIds).toEqual(IDS);
    expect(record.issuedAt).toBe('2026-10-09T03:45:00.000Z');
    expect(record.clueSnapshot.pitches.map(p => p.canonicalPlayerId)).toEqual(IDS);
    expect(record).not.toHaveProperty('puzzleDate');
    expect(record).not.toHaveProperty('dailyNumber');
  });

  it('rejects invalid and non-versioned opaque puzzle identifiers', () => {
    for (const id of ['daily-9', 'custom-nine-v1-1', 'custom-nine-v2-' + ID.slice(15),
      'custom-nine-v1-123e4567-e89b-12d3-a456-426614174000', ID.toUpperCase(), '']) {
      expect(() => validateCustomNinePuzzleId(id)).toThrow('Invalid Custom Nine puzzle ID');
    }
    expect(() => validateCustomNinePuzzleId(ID)).not.toThrow();
  });

  it('rejects duplicate selections or clue snapshots not matching ordered players', () => {
    const input = fixture();
    expect(() => createCustomNineIssuedChallenge({ ...input, canonicalPlayerIds: IDS.slice(0, 8) }))
      .toThrow('exactly nine');
    expect(() => createCustomNineIssuedChallenge({ ...input, canonicalPlayerIds: [...IDS.slice(0, 8), IDS[0]!] }))
      .toThrow('same player');
    const reversed = [...IDS].reverse();
    expect(() => createCustomNineIssuedChallenge({ ...input, canonicalPlayerIds: reversed }))
      .toThrow('does not match');
  });

  it('rejects unsupported, incomplete or reordered clue snapshots via existing four-hint validator', () => {
    const input = fixture();
    const incomplete = { ...input.clueSnapshot, pitches: input.clueSnapshot.pitches.slice(0, 8) };
    expect(() => createCustomNineIssuedChallenge({ ...input, clueSnapshot: incomplete }))
      .toThrow('exactly 9 pitches');
    const reordered = { ...input.clueSnapshot, pitches: [...input.clueSnapshot.pitches].reverse() };
    expect(() => createCustomNineIssuedChallenge({ ...input, clueSnapshot: reordered }))
      .toThrow('exact pitch order');
    expect(() => createCustomNineIssuedChallenge({ ...input, issuedAt: 'not a date' }))
      .toThrow('timestamp');
  });

  it('makes defensive, deeply frozen copies so caller and later readers cannot rewrite issued clues', () => {
    const input = fixture();
    const record = createCustomNineIssuedChallenge(input);
    (input.canonicalPlayerIds as string[])[0] = 'other';
    (input.clueSnapshot.pitches[0]!.hintValues as string[])[0] = 'Tampered';
    expect(record.canonicalPlayerIds[0]).toBe('player-1');
    expect(record.clueSnapshot.pitches[0]?.hintValues[0]).toBe('2000s');
    for (const value of [
      record, record.canonicalPlayerIds, record.clueSnapshot,
      record.clueSnapshot.hintLayout, record.clueSnapshot.hintLayout[0],
      record.clueSnapshot.pitches, record.clueSnapshot.pitches[0],
      record.clueSnapshot.pitches[0]?.hintValues,
    ]) expect(Object.isFrozen(value)).toBe(true);
    expect(() => Object.assign(record, { puzzleId: 'changed' })).toThrow();
    expect(() => Object.assign(record.clueSnapshot.pitches[0]!, { initials: 'ZZ' })).toThrow();
    const copy = cloneCustomNineIssuedChallenge(record);
    expect(copy).toEqual(record);
    expect(copy).not.toBe(record);
    expect(copy.clueSnapshot).not.toBe(record.clueSnapshot);
  });
});

export { fixture, ID };
