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

  it('may contain placeholder positions', () => {
    expect(baseballPlayers.some((player) => player.primaryPosition === 'Unknown')).toBe(true);
  });

  it('does not guarantee generated position or teams enrichment for current demo players', () => {
    const demoPlayers = DEMO_PLAYER_NAMES.map((name) => findPlayerByName(name));

    expect(
      demoPlayers.some((player) => player.primaryPosition === 'Unknown' || player.teamsDisplay === ''),
    ).toBe(true);
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
