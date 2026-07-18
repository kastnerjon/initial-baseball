import { describe, expect, it } from 'vitest';
import { baseballPlayers, dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import type { Player } from '@initial-baseball/shared';
import {
  createDailyPuzzleForDate,
  createDailyPuzzleForDateWithOverrides,
  getDailyPuzzleNumber,
  resolveDailyPuzzleOverridePlayers,
} from './createDailyPuzzleForDate';
import { createGamePitchesFromPuzzle, createPlayerIdentity } from './dailyPuzzleAdapters';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';

const currentOverrideNames = [
  'David Ortiz',
  'Randy Johnson',
  'Whitey Ford',
  'Joe Mauer',
  'Johan Santana',
  'Dave Winfield',
];

describe('createDailyPuzzleForDate', () => {
  it('returns the same player ids in the same order for the same date', () => {
    const firstPuzzle = createDailyPuzzleForDate('2026-05-02');
    const secondPuzzle = createDailyPuzzleForDate('2026-05-02');

    expect(firstPuzzle.pitches.map((pitch) => pitch.player.playerId)).toEqual(
      secondPuzzle.pitches.map((pitch) => pitch.player.playerId),
    );
  });

  it('uses manual override players in the specified order for override dates', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-04');

    expect(puzzle.pitches.map((pitch) => pitch.player.fullName)).toEqual(currentOverrideNames);
  });

  it('resolves current hardened override entries by player ID', () => {
    const players = resolveDailyPuzzleOverridePlayers('2026-05-04', DAILY_PUZZLE_OVERRIDES['2026-05-04']);

    expect(players.map((player) => player.fullName)).toEqual(currentOverrideNames);
  });

  it('creates override puzzles with six unique players', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-04');
    const playerIds = puzzle.pitches.map((pitch) => pitch.player.playerId);

    expect(puzzle.pitches).toHaveLength(6);
    expect(new Set(playerIds).size).toBe(playerIds.length);
  });

  it('does not require override players to come from the core Daily pool', () => {
    const puzzle = createDailyPuzzleForDateWithOverrides('2026-05-05', {
      '2026-05-05': [
        'A. J. Jiménez',
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
      ],
    });
    const overridePlayer = baseballPlayers.find((player) => player.fullName === 'A. J. Jiménez');

    expect(overridePlayer?.dailyEligibilityTier).toBe('none');
    expect(puzzle.pitches[0]?.player.fullName).toBe('A. J. Jiménez');
  });

  it('usually returns a different player sequence for nearby dates', () => {
    const firstPuzzle = createDailyPuzzleForDate('2026-05-02');
    const secondPuzzle = createDailyPuzzleForDate('2026-05-03');

    expect(firstPuzzle.pitches.map((pitch) => pitch.player.playerId)).not.toEqual(
      secondPuzzle.pitches.map((pitch) => pitch.player.playerId),
    );
  });

  it('creates a nine-at-bat puzzle with no duplicate players', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');
    const playerIds = puzzle.pitches.map((pitch) => pitch.player.playerId);

    expect(puzzle.pitches).toHaveLength(9);
    expect(new Set(playerIds).size).toBe(playerIds.length);
  });

  it('selects only Daily-eligible players', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');

    for (const pitch of puzzle.pitches) {
      const player = dailyEligiblePlayers.find((candidate) => candidate.id === pitch.player.playerId);

      expect(player).toBeDefined();
      expect(player?.dailyEligible).toBe(true);
      expect(player?.dailyEligibilityTier).not.toBe('none');
    }
  });

  it('still uses deterministic Daily-eligible players when no override exists', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');
    const playerIds = puzzle.pitches.map((pitch) => pitch.player.playerId);

    for (const playerId of playerIds) {
      const player = dailyEligiblePlayers.find((candidate) => candidate.id === playerId);

      expect(player).toBeDefined();
    }
  });

  it('keeps puzzle metadata stable and increments puzzle numbers by one day', () => {
    const firstPuzzle = createDailyPuzzleForDate('2026-04-27');
    const secondPuzzle = createDailyPuzzleForDate('2026-04-28');

    expect(firstPuzzle.puzzleDate).toBe('2026-04-27');
    expect(firstPuzzle.puzzleNumber).toBe(getDailyPuzzleNumber('2026-04-27'));
    expect(secondPuzzle.puzzleNumber).toBe(firstPuzzle.puzzleNumber + 1);
  });

  it('throws a clear error for missing override player names', () => {
    expect(() => createDailyPuzzleForDateWithOverrides('2026-05-06', {
      '2026-05-06': [
        'Definitely Not A Real Player',
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
      ],
    })).toThrow('Daily puzzle override for 2026-05-06 could not resolve player: Definitely Not A Real Player.');
  });

  it('throws a clear error when an override resolves duplicate players', () => {
    expect(() => createDailyPuzzleForDateWithOverrides('2026-05-07', {
      '2026-05-07': [
        'Ken Griffey Jr.',
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
      ],
    })).toThrow('Daily puzzle override for 2026-05-07 resolves duplicate player:');
  });

  it('throws a clear error when an override player name is ambiguous', () => {
    expect(() => createDailyPuzzleForDateWithOverrides('2026-05-08', {
      '2026-05-08': [
        'David Ortiz',
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    })).toThrow('Daily puzzle override for 2026-05-08 resolved ambiguous player name: David Ortiz.');
  });

  it('resolves object override entries by playerId', () => {
    const davidOrtiz = requirePlayerById('chadwick:0fa4c972');
    const puzzle = createDailyPuzzleForDateWithOverrides('2026-05-09', {
      '2026-05-09': [
        { name: 'David Ortiz', playerId: davidOrtiz.id },
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    });

    expect(puzzle.pitches[0]?.player.playerId).toBe(davidOrtiz.id);
    expect(puzzle.pitches[0]?.player.fullName).toBe(davidOrtiz.fullName);
  });

  it('throws a clear error for object override entries with a bad playerId', () => {
    expect(() => createDailyPuzzleForDateWithOverrides('2026-05-10', {
      '2026-05-10': [
        { name: 'David Ortiz', playerId: 'missing-player-id' },
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    })).toThrow('Daily puzzle override for 2026-05-10 could not resolve playerId: missing-player-id.');
  });

  it('throws a clear error for object override entries with a mismatched name', () => {
    const davidOrtiz = requirePlayerById('chadwick:0fa4c972');

    expect(() => createDailyPuzzleForDateWithOverrides('2026-05-11', {
      '2026-05-11': [
        { name: 'Ken Griffey Jr.', playerId: davidOrtiz.id },
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    })).toThrow(`Daily puzzle override for 2026-05-11 playerId ${davidOrtiz.id} does not match name: Ken Griffey Jr.`);
  });

  it('allows an ambiguous player when a playerId object disambiguates it', () => {
    const davidOrtiz = requirePlayerById('chadwick:0fa4c972');
    const players = resolveDailyPuzzleOverridePlayers('2026-05-12', [
      { name: 'David Ortiz', playerId: davidOrtiz.id },
      'Ken Griffey Jr.',
      'David Wright',
      'CC Sabathia',
      'Derek Jeter',
      'Ichiro Suzuki',
    ]);

    expect(players[0]?.id).toBe(davidOrtiz.id);
  });

  it('still throws when object override entries resolve duplicate player IDs', () => {
    const kenGriffeyJr = requirePlayerByName('Ken Griffey Jr.');

    expect(() => resolveDailyPuzzleOverridePlayers('2026-05-13', [
      'Ken Griffey Jr.',
      { name: 'Ken Griffey Jr.', playerId: kenGriffeyJr.id },
      'David Wright',
      'CC Sabathia',
      'Derek Jeter',
      'Ichiro Suzuki',
    ])).toThrow('Daily puzzle override for 2026-05-13 resolves duplicate player:');
  });
});

describe('createGamePitchesFromPuzzle', () => {
  it('builds four ordered hints per pitch from the selected player record', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-02');
    const pitches = createGamePitchesFromPuzzle(puzzle);

    for (const pitch of pitches) {
      const player = dailyEligiblePlayers.find((candidate) => candidate.id === pitch.correctPlayerId);

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

  it('builds override player hints from generated player records', () => {
    const puzzle = createDailyPuzzleForDate('2026-05-04');
    const pitches = createGamePitchesFromPuzzle(puzzle);

    for (const pitch of pitches) {
      const player = baseballPlayers.find((candidate) => candidate.id === pitch.correctPlayerId);

      expect(player).toBeDefined();
      expect(pitch.hints).toHaveLength(4);
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
    firstYear: null,
    lastYear: null,
    yearsPlayedDisplay: 'Unknown',
    primaryTeam: 'SEA',
    teamsDisplay: 'SEA',
    statsLine: 'HR 1 / RBI 1 / BA .250 / OBP .300 / SB 1',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}

function requirePlayerById(playerId: string): Player {
  const player = baseballPlayers.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    throw new Error(`Missing expected player: ${playerId}`);
  }

  return player;
}

function requirePlayerByName(name: string): Player {
  const player = baseballPlayers.find((candidate) => candidate.fullName === name);

  if (player === undefined) {
    throw new Error(`Missing expected player: ${name}`);
  }

  return player;
}
