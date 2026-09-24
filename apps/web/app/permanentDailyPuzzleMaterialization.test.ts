import {
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIssuedPuzzle,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { materializePermanentDailyIssuedPuzzle } from './permanentDailyPuzzleMaterialization';

const CANONICAL_IDS = Array.from({ length: 9 }, (_, index) => `canonical-player-${index + 1}`);
const PLAYERS = new Map(
  CANONICAL_IDS.map((canonicalPlayerId, index) => [
    canonicalPlayerId,
    buildPlayer(index + 1),
  ]),
);

describe('permanent Daily puzzle materialization', () => {
  it('preserves frozen identity and batting order while reusing current Daily pitch construction', () => {
    const issuedPuzzle = createIssuedPuzzle();
    const resolvePlayer = vi.fn((canonicalPlayerId: string) => PLAYERS.get(canonicalPlayerId) ?? null);

    const puzzle = materializePermanentDailyIssuedPuzzle(issuedPuzzle, resolvePlayer);

    expect(puzzle).toMatchObject({
      id: 'permanent-v1-daily-1',
      puzzleNumber: 1,
      puzzleDate: '2030-04-05',
      status: 'published',
    });
    expect(puzzle.pitches.map(pitch => pitch.player.playerId)).toEqual(CANONICAL_IDS);
    expect(puzzle.pitches.map(pitch => pitch.pitchNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(resolvePlayer.mock.calls.map(([canonicalPlayerId]) => canonicalPlayerId))
      .toEqual(CANONICAL_IDS);

    const firstPlayer = PLAYERS.get(CANONICAL_IDS[0]!);
    if (firstPlayer === undefined) throw new Error('Expected first materialization fixture.');
    const expectedPitch = createDailyPuzzlePitch(1, firstPlayer);
    expect(puzzle.pitches[0]).toEqual({
      ...expectedPitch,
      player: {
        ...expectedPitch.player,
        playerId: CANONICAL_IDS[0],
      },
    });
  });

  it('keeps the current shared hint and stats configuration without choosing a game ruleset', () => {
    const puzzle = materializePermanentDailyIssuedPuzzle(
      createIssuedPuzzle(),
      canonicalPlayerId => PLAYERS.get(canonicalPlayerId) ?? null,
    );

    expect(puzzle.hintConfig.map(slot => slot.hintType)).toEqual([
      'main_decade',
      'teams',
      'position',
      'stats',
    ]);
    expect(puzzle.statsHintConfig.hitter.length).toBeGreaterThan(0);
    expect(puzzle.statsHintConfig.pitcher.length).toBeGreaterThan(0);
    expect(puzzle).not.toHaveProperty('rulesetVersion');
  });

  it('fails closed when a frozen canonical player cannot be materialized', () => {
    const issuedPuzzle = createIssuedPuzzle();
    const unavailableId = CANONICAL_IDS[4]!;

    expect(() => materializePermanentDailyIssuedPuzzle(
      issuedPuzzle,
      canonicalPlayerId => (
        canonicalPlayerId === unavailableId
          ? null
          : PLAYERS.get(canonicalPlayerId) ?? null
      ),
    )).toThrow(
      `Permanent Daily ${issuedPuzzle.puzzleId} references unavailable canonical player ${unavailableId}.`,
    );
  });
});

function createIssuedPuzzle(): PermanentDailyIssuedPuzzle {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');

  return createPermanentDailyIssuedPuzzle({
    identity,
    canonicalPlayerIds: CANONICAL_IDS,
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}

function buildPlayer(index: number): Player {
  return {
    id: `legacy-player-${index}`,
    fullName: `Player ${index}`,
    displayName: `Player ${index}`,
    primaryRole: index === 9 ? 'pitcher' : 'hitter',
    primaryPosition: index === 9 ? 'P' : 'CF',
    mainDecade: '2000s',
    firstYear: 2001,
    lastYear: 2010,
    yearsPlayedDisplay: '2001–2010',
    primaryTeam: 'NYY',
    teamsDisplay: 'NYY, BOS',
    statsLine: index === 9
      ? 'W 100 / L 80 / ERA 3.50 / WHIP 1.20 / K 1500'
      : 'HR 200 / RBI 800 / BA .275 / OBP .350 / SB 100',
    careerStats: index === 9
      ? {
          kind: 'pitcher',
          stats: {
            W: 100,
            L: 80,
            SV: 0,
            ERA: '3.50',
            WHIP: '1.20',
            K: 1500,
            IP: '1800.0',
          },
        }
      : {
          kind: 'hitter',
          stats: {
            AB: 5000,
            H: 1400,
            HR: 200,
            BA: '.280',
            R: 800,
            RBI: 800,
            SB: 100,
            OBP: '.350',
            SLG: '.450',
            OPS: '.800',
          },
        },
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}
