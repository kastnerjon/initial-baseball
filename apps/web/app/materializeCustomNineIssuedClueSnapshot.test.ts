import type { Player } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./canonicalDailyPlayerLookup', () => ({ getCanonicalDailyPlayer: vi.fn() }));

import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { materializeCustomNineIssuedClueSnapshot } from './materializeCustomNineIssuedClueSnapshot';
import { materializePermanentDailyIssuedClueSnapshot } from './materializePermanentDailyIssuedClueSnapshot';

const IDS = Array.from({ length: 9 }, (_, index) => `canonical-player-${index + 1}`);
const PLAYERS = new Map(IDS.map((id, index) => [id, player(index + 1)] as const));
const resolve = (id: string) => PLAYERS.get(id) ?? null;

describe('Custom Nine canonical player and clue materialization', () => {
  it('freezes the exact four existing Daily hint categories and values in selected order', () => {
    const order = [...IDS].reverse();
    const resolvePlayer = vi.fn(resolve);
    const snapshot = materializeCustomNineIssuedClueSnapshot(order, resolvePlayer);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.hintLayout.map(hint => [hint.slot, hint.hintType])).toEqual([
      [1, 'main_decade'],
      [2, 'teams'],
      [3, 'position'],
      [4, 'stats'],
    ]);
    expect(snapshot.pitches.map(pitch => pitch.canonicalPlayerId)).toEqual(order);
    expect(snapshot.pitches.map(pitch => pitch.pitchNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(snapshot.pitches.every(pitch => pitch.hintValues.length === 4)).toBe(true);
    expect(snapshot.pitches[0]?.hintValues).toEqual([
      '1990s',
      'NYM',
      'CF',
      'HR 150 / RBI 700 / SB 60 / BA .280 / OBP .350',
    ]);
    expect(snapshot).toEqual(materializePermanentDailyIssuedClueSnapshot(order, resolve));
    expect(resolvePlayer.mock.calls.map(([id]) => id)).toEqual(order);
    expect(order).toEqual([...IDS].reverse());
  });

  it('rejects invalid, duplicate and short selections before any player lookup', () => {
    const resolver = vi.fn(resolve);
    for (const order of [[...IDS.slice(0, 8)], [...IDS.slice(0, 8), IDS[0]!], ['bad-id', ...IDS]]) {
      expect(() => materializeCustomNineIssuedClueSnapshot(order, resolver)).toThrow();
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it('rejects an unknown canonical ID and does not expose it through an error', () => {
    const secretId = 'private-player-that-is-not-in-canonical-data';
    const input = [...IDS.slice(0, 8), secretId];
    const resolver = vi.fn(resolve);
    expect(() => materializeCustomNineIssuedClueSnapshot(input, resolver))
      .toThrow('Custom Nine requires nine existing players with complete supported clues.');
    try {
      materializeCustomNineIssuedClueSnapshot(input, resolver);
    } catch (error) {
      expect(String(error)).not.toContain(secretId);
    }
    expect(resolver).toHaveBeenCalledWith(secretId);
  });

  it.each([
    ['main decade', { mainDecade: 'Unknown' }],
    ['teams', { teamsDisplay: ' ' }],
    ['position', { primaryPosition: 'Unknown' }],
    ['career stats', { careerStats: null }],
  ] as const)('refuses %s placeholder rather than issuing a broken Custom puzzle', (_field, change) => {
    const resolver = (id: string) => {
      const existing = resolve(id);
      return existing === null ? null : id === IDS[0] ? { ...existing, ...change } : existing;
    };
    expect(() => materializeCustomNineIssuedClueSnapshot(IDS, resolver))
      .toThrow('Custom Nine requires nine existing players with complete supported clues.');
  });

  it('refuses empty or missing generated hints and masks errors containing private answer IDs', () => {
    const makePitch = (number: number, selected: Player) => {
      if (number === 2) throw new Error(`Could not materialize ${IDS[1]}`);
      return createDailyPuzzlePitch(number, selected);
    };
    expect(() => materializeCustomNineIssuedClueSnapshot(IDS, resolve, makePitch))
      .toThrow('Custom Nine requires nine existing players with complete supported clues.');

    const emptyHint = (number: number, selected: Player) => ({
      ...createDailyPuzzlePitch(number, selected),
      hints: { main_decade: '1990s', teams: '', position: 'CF', stats: 'HR 150' },
    });
    expect(() => materializeCustomNineIssuedClueSnapshot(IDS, resolve, emptyHint))
      .toThrow('Custom Nine requires nine existing players with complete supported clues.');
  });
});

function player(index: number): Player {
  return {
    id: `legacy-player-${index}`,
    fullName: `Test Player ${index}`,
    displayName: `Test Player ${index}`,
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '1990s',
    firstYear: 1988,
    lastYear: 2004,
    yearsPlayedDisplay: '1988–2004',
    primaryTeam: 'NYM',
    teamsDisplay: 'NYM',
    statsLine: 'HR 150 / RBI 700 / BA .280 / OBP .350 / SB 60',
    careerStats: {
      kind: 'hitter',
      stats: {
        AB: 4500, R: 600, H: 1260, HR: 150, RBI: 700, SB: 60,
        BA: '.280', OBP: '.350', SLG: '.450', OPS: '.800',
      },
    },
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}
