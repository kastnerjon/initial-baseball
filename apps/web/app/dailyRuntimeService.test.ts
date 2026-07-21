import { createCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG, type DailyPuzzle } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { DailyRuntimeRequestError, createDailyRuntimeService } from './dailyRuntimeService';

const answerId = 'ibp_ab000000000000000000';
const otherId = 'ibp_cd000000000000000000';
const legacyId = 'chadwick:answer';
const date = '2026-07-22';
const tokens = createDailyProgressionTokenCodec('daily-runtime-service-test-secret-0123456789');
const service = createDailyRuntimeService({
  canonicalRuntime: buildRuntime(),
  createPuzzle: async puzzleDate => buildPuzzle(puzzleDate),
  progressionTokens: tokens,
});

describe('Daily canonical runtime service', () => {
  it('awaits the server puzzle source and exposes no answers or hints in bootstrap', async () => {
    const bootstrap = await service.getBootstrap(date);
    const serialized = JSON.stringify(bootstrap);
    expect(bootstrap.puzzle.pitches[0]).toEqual({ pitchNumber: 1, initials: 'HA' });
    expect(serialized).not.toContain(answerId);
    expect(serialized).not.toContain(legacyId);
    expect(serialized).not.toContain('Hidden Answer');
    expect(serialized).not.toContain('Career marker');
  });

  it('recreates the same server-selected puzzle for authorized hint and resolution actions', async () => {
    const bootstrap = await service.getBootstrap(date);
    const hinted = await service.revealHint(bootstrap.progressionToken);
    expect(hinted.hint.hintValue).toBe('2000s');
    const resolved = await service.resolveAtBat({ progressionToken: hinted.progressionToken, submittedPlayerId: legacyId });
    expect(resolved.result).toMatchObject({ kind: 'correct', outcome: '3B' });
    expect(resolved.reveal).toMatchObject({ playerId: answerId, displayName: 'Hidden Answer' });
  });

  it('rejects invalid progression and unknown submitted IDs', async () => {
    await expect(service.revealHint('invalid')).rejects.toBeInstanceOf(DailyRuntimeRequestError);
    const bootstrap = await service.getBootstrap(date);
    await expect(service.resolveAtBat({ progressionToken: bootstrap.progressionToken, submittedPlayerId: 'unknown' }))
      .rejects.toBeInstanceOf(DailyRuntimeRequestError);
  });

  it('keeps Give Up as a token-authorized terminal at-bat action', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({ progressionToken: bootstrap.progressionToken, giveUp: true });
    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe('Hidden Answer');
  });
});

function buildPuzzle(puzzleDate: string): DailyPuzzle {
  return {
    id: `daily-${puzzleDate}`,
    puzzleNumber: 87,
    puzzleDate,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      player: { playerId: legacyId, fullName: 'Hidden Legal Answer', displayName: 'Hidden Answer', initials: 'HA', kind: 'hitter' as const, primaryPosition: '1B' },
      hints: { main_decade: '2000s', teams: 'AAA', position: '1B', stats: 'Career marker' },
    })),
  };
}

function buildRuntime() {
  return createCanonicalRuntimeAccessor({
    playerIndex: {
      schemaVersion: 1,
      players: [answerId, otherId].map(playerId => ({
        playerId,
        lahmanPlayerId: playerId === answerId ? 'answer01' : 'other01',
        displayName: playerId === answerId ? 'Hidden Answer' : 'Other Player',
        aliases: [], playerType: 'hitter' as const, primaryPosition: '1B', firstSeason: 2000, lastSeason: 2000,
        seasonCount: 1, teamIds: ['AAA'], isHallOfFamer: false, revealShard: `reveal-shards/${playerId.slice(4, 6)}.json`,
      })),
    },
    redirects: { schemaVersion: 1, redirects: { [legacyId]: answerId }, excludedRedirects: [] },
    loadRevealShard: path => {
      const playerId = path.includes('/ab.') ? answerId : otherId;
      return {
        schemaVersion: 1, shardId: playerId.slice(4, 6), players: {
          [playerId]: {
            schemaVersion: 1, playerId, lahmanPlayerId: playerId === answerId ? 'answer01' : 'other01',
            displayName: playerId === answerId ? 'Hidden Answer' : 'Other Player', playerType: 'hitter',
            career: { firstSeason: 2000, lastSeason: 2000, seasonCount: 1, teamIds: ['AAA'], primaryPosition: '1B', batting: null, pitching: null, advanced: null, achievements: {} },
            seasons: [], provenance: { canonicalUniversePresent: true, careerEnrichmentPresent: true, seasonCardCount: 0, legalNameExcludedFromDisplayPayload: true },
          },
        },
      };
    },
  });
}
