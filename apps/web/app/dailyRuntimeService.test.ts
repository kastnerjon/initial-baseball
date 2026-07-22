import { createCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import { DEFAULT_DAILY_HINT_CONFIG, DEFAULT_DAILY_STATS_HINT_CONFIG, type DailyPuzzle } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { createDailyProgressionTokenCodec, type DailyProgressionClaims } from './dailyProgressionToken';
import { DailyRuntimeRequestError, createDailyRuntimeService } from './dailyRuntimeService';

const answerId = 'ibp_ab000000000000000000';
const otherId = 'ibp_cd000000000000000000';
const legacyId = 'chadwick:answer';
const answerName = 'Hidden Answer';
const revealMarker = 'FULL_REVEAL_MARKER';
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
    expect(bootstrap.puzzle.pitches).toHaveLength(9);
    expect(bootstrap.puzzle.pitches[0]).toEqual({ pitchNumber: 1, initials: 'HA' });
    expect(tokens.verify(bootstrap.progressionToken)).toEqual(initialClaims());
    expect(serialized).not.toContain(answerId);
    expect(serialized).not.toContain(legacyId);
    expect(serialized).not.toContain(answerName);
    expect(serialized).not.toContain('Career marker');
    expect(serialized).not.toContain(revealMarker);
  });

  it('releases one authorized hint and advances only hint depth', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.revealHint(bootstrap.progressionToken);
    expect(response.hint).toEqual({ hintType: 'main_decade', hintLabel: 'Main decade played in', hintValue: '2000s' });
    expect(tokens.verify(response.progressionToken)).toEqual({ ...initialClaims(), revealCount: 1 });
    expect(JSON.stringify(response)).not.toContain(answerId);
    expect(JSON.stringify(response)).not.toContain(answerName);
  });

  it('rejects hint requests beyond the configured maximum', async () => {
    await expect(service.revealHint(tokens.sign({ ...initialClaims(), revealCount: 4 }))).rejects.toThrow(/No additional hint/);
  });

  it('returns no reveal and increments signed strikes for an incorrect guess', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({ progressionToken: bootstrap.progressionToken, submittedPlayerId: otherId });
    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(tokens.verify(response.progressionToken)).toEqual({ ...initialClaims(), strikeCount: 1 });
    expect(JSON.stringify(response)).not.toContain(answerName);
    expect(JSON.stringify(response)).not.toContain(revealMarker);
  });

  it('uses token hint depth for a correct outcome and advances to the next pitch', async () => {
    const bootstrap = await service.getBootstrap(date);
    const hinted = await service.revealHint(bootstrap.progressionToken);
    const response = await service.resolveAtBat({ progressionToken: hinted.progressionToken, submittedPlayerId: answerId });
    expect(response.result).toMatchObject({ kind: 'correct', outcome: '3B' });
    expect(response.reveal).toMatchObject({ playerId: answerId, displayName: answerName });
    expect(tokens.verify(response.progressionToken)).toEqual({ ...initialClaims(), pitchNumber: 2 });
  });

  it('accepts a valid legacy selected ID through the canonical redirect boundary', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({ progressionToken: bootstrap.progressionToken, submittedPlayerId: legacyId });
    expect(response.result.kind).toBe('correct');
  });

  it('rejects invalid progression, unknown submitted IDs, and puzzle mismatches', async () => {
    await expect(service.revealHint('invalid')).rejects.toBeInstanceOf(DailyRuntimeRequestError);
    const bootstrap = await service.getBootstrap(date);
    await expect(service.resolveAtBat({ progressionToken: bootstrap.progressionToken, submittedPlayerId: 'unknown' }))
      .rejects.toBeInstanceOf(DailyRuntimeRequestError);
    await expect(service.revealHint(tokens.sign({ ...initialClaims(), puzzleId: 'daily-2026-07-21' })))
      .rejects.toThrow(/does not match its puzzle/);
  });

  it('returns the reveal, increments outs, and advances after a third strike', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({ ...initialClaims(), revealCount: 2, strikeCount: 2 }),
      submittedPlayerId: otherId,
    });
    expect(response.result).toMatchObject({ kind: 'strikeout', strikeCount: 3 });
    expect(response.reveal?.displayName).toBe(answerName);
    expect(tokens.verify(response.progressionToken)).toEqual({ ...initialClaims(), pitchNumber: 2, outCount: 1 });
  });

  it('keeps Give Up as a token-authorized terminal at-bat action', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({ progressionToken: bootstrap.progressionToken, giveUp: true });
    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe(answerName);
    expect(tokens.verify(response.progressionToken)).toMatchObject({ pitchNumber: 2, revealCount: 0, strikeCount: 0, outCount: 1, completed: false });
  });

  it('completes after three outs and rejects later actions', async () => {
    const response = await service.resolveAtBat({ progressionToken: tokens.sign({ ...initialClaims(), outCount: 2 }), giveUp: true });
    expect(tokens.verify(response.progressionToken)).toMatchObject({ outCount: 3, completed: true, pitchNumber: 1 });
    await expect(service.revealHint(response.progressionToken)).rejects.toThrow(/already complete/);
  });

  it('completes after the ninth scheduled pitch', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({ ...initialClaims(), pitchNumber: 9 }),
      submittedPlayerId: answerId,
    });
    expect(tokens.verify(response.progressionToken)).toMatchObject({ pitchNumber: 9, completed: true });
  });
});

function initialClaims(): DailyProgressionClaims {
  return { version: 1, puzzleId: `daily-${date}`, puzzleDate: date, pitchNumber: 1, revealCount: 0, strikeCount: 0, outCount: 0, completed: false };
}

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
      player: { playerId: legacyId, fullName: 'Hidden Legal Answer', displayName: answerName, initials: 'HA', kind: 'hitter' as const, primaryPosition: '1B' },
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
        displayName: playerId === answerId ? answerName : 'Other Player',
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
            displayName: playerId === answerId ? answerName : 'Other Player', playerType: 'hitter',
            career: {
              firstSeason: 2000, lastSeason: 2000, seasonCount: 1, teamIds: ['AAA'], primaryPosition: '1B',
              batting: null, pitching: null, advanced: null, achievements: { marker: revealMarker },
            },
            seasons: [], provenance: { canonicalUniversePresent: true, careerEnrichmentPresent: true, seasonCardCount: 0, legalNameExcludedFromDisplayPayload: true },
          },
        },
      };
    },
  });
}
