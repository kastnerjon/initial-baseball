import { describe, expect, it } from 'vitest';
import {
  cloneCustomLineupIssuedChallenge,
  createCustomLineupIssuedChallenge,
  validateCustomLineupPuzzleId,
  CUSTOM_LINEUP_ISSUED_CHALLENGE_SCHEMA_VERSION,
} from './customLineupIssuedChallenge';
import {
  createCustomLineupSelection,
  CUSTOM_LINEUP_SELECTION_SCHEMA_VERSION,
} from './customLineupSelection';
import {
  createCustomLineupIssuedClueSnapshot,
  cloneCustomLineupIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';
import { createCustomNineIssuedChallenge } from './customNineIssuedChallenge';
import { fixture as legacyFixture } from './customNineIssuedChallenge.testFixture';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const IDS = Array.from({ length: 11 }, (_, i) => `player-${i + 1}`);
const HINT_LAYOUT = [
  { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade' },
  { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
  { slot: 3, hintType: 'position', displayLabel: 'Position' },
  { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
] as const;

function clues(count: number) {
  return createCustomLineupIssuedClueSnapshot({
    hintLayout: HINT_LAYOUT,
    pitches: IDS.slice(0, count).map((canonicalPlayerId, i) => ({
      pitchNumber: i + 1,
      canonicalPlayerId,
      initials: `P${i + 1}`,
      hintValues: ['2000s', 'Mets', 'SS', 'HR 123'],
    })),
  });
}

function input(count: number) {
  return {
    puzzleId: ID,
    canonicalPlayerIds: IDS.slice(0, count),
    clueSnapshot: clues(count),
    issuedAt: '2026-10-08T23:45:00-04:00',
  };
}

describe('Custom Lineup v2 portable contracts (not hosted issuance)', () => {
  it.each([1, 5, 9, 10])('accepts %i distinct players, preserving order and deep-frozen clues', n => {
    const requested = input(n);
    const reversed = [...requested.canonicalPlayerIds].reverse();
    requested.canonicalPlayerIds = reversed;
    requested.clueSnapshot = createCustomLineupIssuedClueSnapshot({
      hintLayout: HINT_LAYOUT,
      pitches: reversed.map((canonicalPlayerId, i) => ({
        pitchNumber: i + 1,
        canonicalPlayerId,
        initials: `P${i + 1}`,
        hintValues: ['2000s', 'Mets', 'SS', 'HR 123'],
      })),
    });

    const issued = createCustomLineupIssuedChallenge(requested);
    expect(issued.schemaVersion).toBe(CUSTOM_LINEUP_ISSUED_CHALLENGE_SCHEMA_VERSION);
    expect(issued.rulesetVersion).toBe('points-v4');
    expect(issued.puzzleId).toBe(ID);
    expect(issued.issuedAt).toBe('2026-10-09T03:45:00.000Z');
    expect(issued.canonicalPlayerIds).toEqual(reversed);
    expect(issued.clueSnapshot.pitches).toHaveLength(n);
    expect(issued.clueSnapshot.pitches.map(p => p.canonicalPlayerId)).toEqual(reversed);
    expect(issued.clueSnapshot.pitches.every(p => p.hintValues.length === 4)).toBe(true);
    expect(issued).not.toHaveProperty('puzzleDate');
    expect(issued).not.toHaveProperty('dailyNumber');

    requested.canonicalPlayerIds[0] = 'tampered';
    (requested.clueSnapshot.pitches[0]!.hintValues as string[])[0] = 'tampered';
    expect(issued.canonicalPlayerIds[0]).toBe(IDS[n - 1]);
    expect(issued.clueSnapshot.pitches[0]?.hintValues[0]).toBe('2000s');

    const cloned = cloneCustomLineupIssuedChallenge(issued);
    expect(cloned).toEqual(issued);
    expect(cloned).not.toBe(issued);
    expect(cloned.clueSnapshot.pitches[0]?.hintValues)
      .not.toBe(issued.clueSnapshot.pitches[0]?.hintValues);
    for (const value of [
      issued, issued.canonicalPlayerIds, issued.clueSnapshot,
      issued.clueSnapshot.hintLayout, issued.clueSnapshot.hintLayout[0],
      issued.clueSnapshot.pitches, issued.clueSnapshot.pitches[0],
      issued.clueSnapshot.pitches[0]?.hintValues,
    ]) expect(Object.isFrozen(value)).toBe(true);
  });

  it('enforces exact v2 UUID identity and rejects legacy or malformed IDs', () => {
    expect(() => validateCustomLineupPuzzleId(ID)).not.toThrow();
    for (const id of [
      'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000',
      'custom-lineup-v2-123e4567-e89b-12d3-a456-426614174000',
      ID.toUpperCase(), 'custom-lineup-v2-not-a-uuid', '',
    ]) expect(() => validateCustomLineupPuzzleId(id)).toThrow('Invalid Custom Lineup puzzle ID');
    expect(() => createCustomLineupIssuedChallenge({ ...input(1), issuedAt: 'invalid' }))
      .toThrow('timestamp');
    const good = createCustomLineupIssuedChallenge(input(1));
    expect(() => cloneCustomLineupIssuedChallenge({
      ...good, schemaVersion: 1 as 2,
    })).toThrow('Unsupported Custom Lineup issued challenge version');
  });

  it('rejects 0/11 players and invalid, padded or duplicate canonical identities', () => {
    for (const n of [0, 11]) {
      expect(() => createCustomLineupSelection(IDS.slice(0, n)))
        .toThrow('1 through 10 players');
    }
    for (const bad of ['', ' padded', 'padded ', 'x'.repeat(201), 4]) {
      expect(() => createCustomLineupSelection(['player-1', bad] as string[]))
        .toThrow('valid canonical player IDs');
    }
    expect(() => createCustomLineupSelection(['player-1', 'player-1']))
      .toThrow('same player');
    expect(() => createCustomLineupSelection(null as unknown as string[]))
      .toThrow('1 through 10 players');
    expect(createCustomLineupSelection(['player-9'])).toEqual({
      schemaVersion: CUSTOM_LINEUP_SELECTION_SCHEMA_VERSION,
      canonicalPlayerIds: ['player-9'],
    });
    expect(() => createCustomLineupIssuedChallenge({
      ...input(2), canonicalPlayerIds: ['player-1', 'player-1'],
    })).toThrow('same player');
  });

  it('requires matching count and canonical player order in fully frozen clues', () => {
    expect(() => createCustomLineupIssuedClueSnapshot({
      hintLayout: HINT_LAYOUT, pitches: [],
    })).toThrow('1 through 10 pitches');
    expect(() => createCustomLineupIssuedClueSnapshot({
      hintLayout: HINT_LAYOUT,
      pitches: IDS.map((canonicalPlayerId, i) => ({
        canonicalPlayerId, pitchNumber: i + 1, initials: 'P',
        hintValues: ['2000s', 'Mets', 'SS', 'HR 123'],
      })),
    })).toThrow('1 through 10 pitches');
    const requested = input(5);
    expect(() => createCustomLineupIssuedChallenge({
      ...requested, canonicalPlayerIds: IDS.slice(0, 4),
    })).toThrow('length must match');
    expect(() => createCustomLineupIssuedChallenge({
      ...requested, canonicalPlayerIds: [...IDS.slice(1, 5), IDS[0]!],
    })).toThrow('does not match the selected player order');

    const reversedPitches = {
      ...requested.clueSnapshot,
      pitches: [...requested.clueSnapshot.pitches].reverse(),
    };
    expect(() => cloneCustomLineupIssuedClueSnapshot(reversedPitches))
      .toThrow('exact pitch order');
    expect(() => createCustomLineupIssuedChallenge({
      ...requested,
      clueSnapshot: {
        ...requested.clueSnapshot,
        pitches: requested.clueSnapshot.pitches.slice(0, 4),
      },
    })).toThrow('length must match');
  });

  it('rejects missing, reordered, or unsupported placeholder hints and unknown schema', () => {
    const requested = input(5);
    for (const placeholder of ['Unknown', 'Teams unavailable', 'Stats unavailable']) {
      const bad = {
        ...requested.clueSnapshot,
        pitches: requested.clueSnapshot.pitches.map((p, i) => i === 0
          ? { ...p, hintValues: [placeholder, ...p.hintValues.slice(1)] } : p),
      };
      expect(() => createCustomLineupIssuedChallenge({ ...requested, clueSnapshot: bad }))
        .toThrow('complete supported clue values');
    }
    expect(() => createCustomLineupIssuedChallenge({
      ...requested,
      clueSnapshot: {
        ...requested.clueSnapshot,
        pitches: requested.clueSnapshot.pitches.map((p, i) => i === 0
          ? { ...p, hintValues: ['2000s', 'Mets', 'SS', '  '] } : p),
      },
    })).toThrow('pitch 1 hint 4 value is required');
    expect(() => cloneCustomLineupIssuedClueSnapshot({
      ...requested.clueSnapshot, schemaVersion: 2 as 1,
    })).toThrow('Unsupported permanent Daily clue snapshot schema version');
  });

  it('preserves v1 exact-nine IDs, clues and rules without reinterpretation', () => {
    const v1 = createCustomNineIssuedChallenge(legacyFixture());
    expect(v1.schemaVersion).toBe(1);
    expect(v1.canonicalPlayerIds).toHaveLength(9);
    expect(v1.puzzleId).toMatch(/^custom-nine-v1-/);
    expect(() => createCustomLineupIssuedChallenge({
      ...input(9), puzzleId: v1.puzzleId,
    })).toThrow('Invalid Custom Lineup puzzle ID');
    expect(() => createCustomNineIssuedChallenge({
      ...legacyFixture(), canonicalPlayerIds: IDS.slice(0, 5),
    })).toThrow('exactly nine');
  });
});
