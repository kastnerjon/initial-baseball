import { describe, expect, it } from 'vitest';
import { coreDailyEligiblePlayers } from '@initial-baseball/baseball-data';
import type { Player } from '@initial-baseball/shared';
import { createDailyPuzzleForDate, getDailyPuzzleNumber } from './createDailyPuzzleForDate';
import { createGamePitchesFromPuzzle, createPlayerIdentity } from './dailyPuzzleAdapters';

describe('createDailyPuzzleForDate', () => {
  it('returns the same player ids in the same order for the same date', () => {
    const firstPuzzle = createDailyPuzzleForDate('2026-05-02');
    const secondPuzzle = createDailyPuzzleForDate('2026-05-02');

    expect(firstPuzzle.pitches.map((pitch) => pitch.player.playerId)).toEqual(
      secondPuzzle.pitches.map((pitch) => pitch.player.playerId),
    );
  });

  it('usually returns a different player sequence for nearby dates', () => {
    const firstPuzzle = createDailyPuzzleForDate('2026-05-02');
    const secondPuzzle = createDailyPuzzleForDate('2026-05-03');

    expect(firstPuzzle.pitches.map((pitch) => pitch.player.playerId)).not.toEqual(
      secondPuzzle.pitches.map((pitch) => pitch.player.playerId),
    );
  });

  it('creates a six-pitch puzzle with no duplicate players', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');
    const playerIds = puzzle.pitches.map((pitch) => pitch.player.playerId);

    expect(puzzle.pitches).toHaveLength(6);
    expect(new Set(playerIds).size).toBe(playerIds.length);
  });

  it('selects only core Daily-eligible players', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');

    for (const pitch of puzzle.pitches) {
      const player = coreDailyEligiblePlayers.find((candidate) => candidate.id === pitch.player.playerId);

      expect(player).toBeDefined();
      expect(player?.dailyEligible).toBe(true);
      expect(player?.dailyEligibilityTier).toBe('core');
    }
  });

  it('keeps puzzle metadata stable and increments puzzle numbers by one day', () => {
    const firstPuzzle = createDailyPuzzleForDate('2026-04-27');
    const secondPuzzle = createDailyPuzzleForDate('2026-04-28');

    expect(firstPuzzle.puzzleDate).toBe('2026-04-27');
    expect(firstPuzzle.puzzleNumber).toBe(getDailyPuzzleNumber('2026-04-27'));
    expect(secondPuzzle.puzzleNumber).toBe(firstPuzzle.puzzleNumber + 1);
  });
});

describe('createGamePitchesFromPuzzle', () => {
  it('builds four ordered hints per pitch from the selected player record', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');
    const pitches = createGamePitchesFromPuzzle(puzzle);

    for (const pitch of pitches) {
      const player = coreDailyEligiblePlayers.find((candidate) => candidate.id === pitch.correctPlayerId);

      expect(player).toBeDefined();
      expect(pitch.hints).toHaveLength(4);
      expect(pitch.hints.map((hint) => hint.hintType)).toEqual([
        'main_decade',
        'teams',
        'position',
        'stats',
      ]);
      expect(pitch.hints[0]?.hintValue).toBe(player?.mainDecade);
      expect(pitch.hints[1]?.hintValue).toBe(player?.teamsDisplay);
      expect(pitch.hints[2]?.hintValue).toBe(player?.primaryPosition);
      expect(pitch.hints[3]?.hintValue).toBe(player?.statsLine);
    }
  });
});

describe('createPlayerIdentity', () => {
  it('generates initials deterministically for representative names', () => {
    expect(createPlayerIdentity(buildPlayer('Ken Griffey Jr.')).initials).toBe('KGJ');
    expect(createPlayerIdentity(buildPlayer('David Wright')).initials).toBe('DW');
    expect(createPlayerIdentity(buildPlayer('C.C. Sabathia')).initials).toBe('CS');
    expect(createPlayerIdentity(buildPlayer('Elly De La Cruz')).initials).toBe('EDLC');
  });
});

function buildPlayer(displayName: string): Player {
  return {
    id: displayName,
    fullName: displayName,
    displayName,
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '1990s',
    primaryTeam: 'SEA',
    teamsDisplay: 'SEA',
    statsLine: 'HR 1 / RBI 1 / BA .250 / OBP .300 / SB 1',
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}
