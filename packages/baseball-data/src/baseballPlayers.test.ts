import { describe, expect, it } from 'vitest';
import { baseballPlayers } from './index.js';

const DEMO_PLAYER_NAMES = [
  'Ken Griffey Jr.',
  'David Wright',
  'CC Sabathia',
  'Andruw Jones',
  'Jason Varitek',
  'Hideki Matsui',
];

describe('baseballPlayers', () => {
  it('contains a broad searchable player universe', () => {
    expect(baseballPlayers.length).toBeGreaterThanOrEqual(1000);
  });

  it('has unique ids', () => {
    expect(new Set(baseballPlayers.map((player) => player.id)).size).toBe(baseballPlayers.length);
  });

  it('includes required fields for every player', () => {
    for (const player of baseballPlayers) {
      expect(player.id.length).toBeGreaterThan(0);
      expect(player.fullName.length).toBeGreaterThan(0);
      expect(player.displayName.length).toBeGreaterThan(0);
      expect(player.primaryPosition.length).toBeGreaterThan(0);
      expect(player.mainDecade.length).toBeGreaterThan(0);
      expect(player.teamsDisplay).toBeTypeOf('string');
      expect(Array.isArray(player.aliases)).toBe(true);
    }
  });

  it('keeps aliases as arrays', () => {
    expect(baseballPlayers.every((player) => Array.isArray(player.aliases))).toBe(true);
  });

  it('includes the current demo puzzle players by searchable name', () => {
    for (const name of DEMO_PLAYER_NAMES) {
      expect(
        baseballPlayers.some((player) => player.fullName === name || player.displayName === name || player.aliases.includes(name)),
      ).toBe(true);
    }
  });

  it('gives a majority of players a non-Unknown primary position', () => {
    const knownPositionCount = baseballPlayers.filter((player) => player.primaryPosition !== 'Unknown').length;

    expect(knownPositionCount).toBeGreaterThan(baseballPlayers.length / 2);
  });

  it('gives a majority of players a non-empty teams display', () => {
    const withTeamsCount = baseballPlayers.filter((player) => player.teamsDisplay.length > 0).length;

    expect(withTeamsCount).toBeGreaterThan(baseballPlayers.length / 2);
  });

  it('splits roles between hitters and pitchers', () => {
    const pitchers = baseballPlayers.filter((player) => player.primaryRole === 'pitcher').length;
    const hitters = baseballPlayers.filter((player) => player.primaryRole === 'hitter').length;

    expect(pitchers).toBeGreaterThan(0);
    expect(hitters).toBeGreaterThan(0);
  });

  it('marks players as pitchers only when their primary position is P', () => {
    for (const player of baseballPlayers) {
      if (player.primaryRole === 'pitcher') {
        expect(player.primaryPosition).toBe('P');
      }
    }
  });

  it('marks players as hitters when their primary position is not P', () => {
    for (const player of baseballPlayers) {
      if (player.primaryPosition !== 'P') {
        expect(player.primaryRole).toBe('hitter');
      }
    }
  });

  it('keeps fallback placeholders for some players without full Lahman coverage', () => {
    expect(baseballPlayers.some((player) => player.primaryPosition === 'Unknown')).toBe(true);
    expect(baseballPlayers.some((player) => player.teamsDisplay === '')).toBe(true);
  });

  it('enriches current demo players with real position and teams data', () => {
    for (const player of DEMO_PLAYER_NAMES.map((name) => findPlayerByName(name))) {
      expect(player.primaryPosition).not.toBe('Unknown');
      expect(player.teamsDisplay.length).toBeGreaterThan(0);
    }
  });

  it('keeps the expected demo player role and position mapping', () => {
    const ccSabathia = findPlayerByName('CC Sabathia');
    const davidWright = findPlayerByName('David Wright');
    const kenGriffeyJr = findPlayerByName('Ken Griffey Jr.');

    expect(ccSabathia.primaryPosition).toBe('P');
    expect(ccSabathia.primaryRole).toBe('pitcher');

    expect(davidWright.primaryPosition).toBe('3B');
    expect(davidWright.primaryRole).toBe('hitter');

    expect(kenGriffeyJr.primaryPosition).toBe('CF');
    expect(kenGriffeyJr.primaryRole).toBe('hitter');
  });
});

function findPlayerByName(name: string) {
  const player = baseballPlayers.find((candidate) => (
    candidate.fullName === name
    || candidate.displayName === name
    || candidate.aliases.includes(name)
  ));

  expect(player).toBeDefined();
  return player!;
}
