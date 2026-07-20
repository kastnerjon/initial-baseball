import { createCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  createDailyProgressionTokenCodec,
  type DailyProgressionClaims,
} from './dailyProgressionToken';
import { DailyRuntimeRequestError, createDailyRuntimeService } from './dailyRuntimeService';

const canonicalPlayerId = 'ibp_ab000000000000000000';
const otherPlayerId = 'ibp_cd000000000000000000';
const legacyPlayerId = 'chadwick:answer';
const answerName = 'Hidden Answer';
const fullRevealMarker = 'FULL_REVEAL_MARKER';
const puzzleDate = '2026-07-20';
const tokenSecret = 'daily-runtime-service-test-secret-0123456789';
const progressionTokens = createDailyProgressionTokenCodec(tokenSecret);
const service = createDailyRuntimeService({
  canonicalRuntime: buildCanonicalRuntime(),
  createPuzzle: buildPuzzle,
  progressionTokens,
});

describe('Daily canonical runtime service', () => {
  it('publishes only puzzle metadata, initials, and public progression before resolution', () => {
    const bootstrap = service.getBootstrap(puzzleDate);
    const serialized = JSON.stringify(bootstrap);

    expect(bootstrap.puzzle.pitches).toHaveLength(9);
    expect(bootstrap.puzzle.pitches[0]).toEqual({ pitchNumber: 1, initials: 'HA' });
    expect(progressionTokens.verify(bootstrap.progressionToken)).toEqual(initialClaims());
    expect(serialized).not.toContain(canonicalPlayerId);
    expect(serialized).not.toContain(legacyPlayerId);
    expect(serialized).not.toContain(answerName);
    expect(serialized).not.toContain('Career marker');
    expect(serialized).not.toContain(fullRevealMarker);
  });

  it('releases one authorized hint and advances only hint depth', () => {
    const bootstrap = service.getBootstrap(puzzleDate);
    const response = service.revealHint(bootstrap.progressionToken);

    expect(response.hint).toEqual({
      hintType: 'main_decade',
      hintLabel: 'Main decade played in',
      hintValue: '2000s',
    });
    expect(progressionTokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      revealCount: 1,
    });
    expect(JSON.stringify(response)).not.toContain(canonicalPlayerId);
    expect(JSON.stringify(response)).not.toContain(answerName);
  });

  it('returns no reveal and increments signed strikes for an incorrect guess', () => {
    const response = service.resolveAtBat({
      progressionToken: service.getBootstrap(puzzleDate).progressionToken,
      submittedPlayerId: otherPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(progressionTokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      strikeCount: 1,
    });
    expect(JSON.stringify(response)).not.toContain(answerName);
    expect(JSON.stringify(response)).not.toContain(fullRevealMarker);
  });

  it('uses token hint depth for a correct outcome and advances to the next pitch', () => {
    const hinted = service.revealHint(service.getBootstrap(puzzleDate).progressionToken);
    const response = service.resolveAtBat({
      progressionToken: hinted.progressionToken,
      submittedPlayerId: canonicalPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'correct', outcome: '3B' });
    expect(response.reveal).toMatchObject({ playerId: canonicalPlayerId, displayName: answerName });
    expect(progressionTokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      pitchNumber: 2,
    });
  });

  it('accepts a valid legacy selected ID through the explicit redirect boundary', () => {
    const response = service.resolveAtBat({
      progressionToken: service.getBootstrap(puzzleDate).progressionToken,
      submittedPlayerId: legacyPlayerId,
    });

    expect(response.result.kind).toBe('correct');
  });

  it('returns the reveal, increments outs, and advances after a third strike', () => {
    const response = service.resolveAtBat({
      progressionToken: progressionTokens.sign({
        ...initialClaims(),
        revealCount: 2,
        strikeCount: 2,
      }),
      submittedPlayerId: otherPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'strikeout', strikeCount: 3 });
    expect(response.reveal?.displayName).toBe(answerName);
    expect(progressionTokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      pitchNumber: 2,
      outCount: 1,
    });
  });

  it('uses Give Up as a token-authorized strikeout transition', () => {
    const response = service.resolveAtBat({
      progressionToken: progressionTokens.sign({
        ...initialClaims(),
        revealCount: 2,
      }),
      giveUp: true,
    });

    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe(answerName);
    expect(progressionTokens.verify(response.progressionToken)).toMatchObject({
      pitchNumber: 2,
      revealCount: 0,
      strikeCount: 0,
      outCount: 1,
      completed: false,
    });
  });

  it('completes after three outs and rejects later answer actions', () => {
    const response = service.resolveAtBat({
      progressionToken: progressionTokens.sign({
        ...initialClaims(),
        outCount: 2,
      }),
      giveUp: true,
    });
    const claims = progressionTokens.verify(response.progressionToken);

    expect(claims).toMatchObject({ outCount: 3, completed: true, pitchNumber: 1 });
    expect(() => service.revealHint(response.progressionToken)).toThrow(/already complete/);
  });

  it('completes after the ninth scheduled pitch', () => {
    const response = service.resolveAtBat({
      progressionToken: progressionTokens.sign({
        ...initialClaims(),
        pitchNumber: 9,
      }),
      submittedPlayerId: canonicalPlayerId,
    });

    expect(progressionTokens.verify(response.progressionToken)).toMatchObject({
      pitchNumber: 9,
      completed: true,
    });
  });

  it('rejects tampering, tokens from another signer, and puzzle/date mismatches', () => {
    const bootstrap = service.getBootstrap(puzzleDate);
    const otherCodec = createDailyProgressionTokenCodec('different-daily-runtime-secret-0123456789abcdef');
    const mismatchedToken = progressionTokens.sign({
      ...initialClaims(),
      puzzleId: 'daily-2026-07-19',
    });

    expect(() => service.revealHint(`${bootstrap.progressionToken}x`)).toThrow(DailyRuntimeRequestError);
    expect(() => service.revealHint(otherCodec.sign(initialClaims()))).toThrow(DailyRuntimeRequestError);
    expect(() => service.revealHint(mismatchedToken)).toThrow(/does not match its puzzle/);
  });
});

function initialClaims(): DailyProgressionClaims {
  return {
    version: 1,
    puzzleId: `daily-${puzzleDate}`,
    puzzleDate,
    pitchNumber: 1,
    revealCount: 0,
    strikeCount: 0,
    outCount: 0,
    completed: false,
  };
}

function buildPuzzle(date: string): DailyPuzzle {
  return {
    id: `daily-${date}`,
    puzzleNumber: 85,
    puzzleDate: date,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      player: {
        playerId: legacyPlayerId,
        fullName: 'Hidden Legal Answer',
        displayName: answerName,
        initials: 'HA',
        kind: 'hitter' as const,
        primaryPosition: '1B',
      },
      hints: {
        main_decade: '2000s',
        teams: 'AAA',
        position: '1B',
        stats: 'Career marker',
      },
    })),
  };
}

function buildCanonicalRuntime() {
  return createCanonicalRuntimeAccessor({
    playerIndex: {
      schemaVersion: 1,
      players: [canonicalPlayerId, otherPlayerId].map(playerId => ({
        playerId,
        lahmanPlayerId: playerId === canonicalPlayerId ? 'answer01' : 'other01',
        displayName: playerId === canonicalPlayerId ? answerName : 'Other Player',
        aliases: [],
        playerType: 'hitter' as const,
        primaryPosition: '1B',
        firstSeason: 2000,
        lastSeason: 2000,
        seasonCount: 1,
        teamIds: ['AAA'],
        isHallOfFamer: false,
        revealShard: `reveal-shards/${playerId.slice(4, 6)}.json`,
      })),
    },
    redirects: {
      schemaVersion: 1,
      redirects: { [legacyPlayerId]: canonicalPlayerId },
      excludedRedirects: [],
    },
    loadRevealShard: (path) => {
      const playerId = path.includes('/ab.') ? canonicalPlayerId : otherPlayerId;
      return {
        schemaVersion: 1,
        shardId: playerId.slice(4, 6),
        players: { [playerId]: buildReveal(playerId) },
      };
    },
  });
}

function buildReveal(playerId: string) {
  return {
    schemaVersion: 1 as const,
    playerId,
    lahmanPlayerId: playerId === canonicalPlayerId ? 'answer01' : 'other01',
    displayName: playerId === canonicalPlayerId ? answerName : 'Other Player',
    playerType: 'hitter' as const,
    career: {
      firstSeason: 2000,
      lastSeason: 2000,
      seasonCount: 1,
      teamIds: ['AAA'],
      primaryPosition: '1B',
      batting: null,
      pitching: null,
      advanced: null,
      achievements: { marker: fullRevealMarker },
    },
    seasons: [],
    provenance: {
      canonicalUniversePresent: true,
      careerEnrichmentPresent: true,
      seasonCardCount: 0,
      legalNameExcludedFromDisplayPayload: true,
    },
  };
}
