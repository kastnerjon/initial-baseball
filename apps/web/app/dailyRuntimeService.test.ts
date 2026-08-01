import { createCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import {
  CURRENT_DAILY_RULESET_VERSION,
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  createDailyProgressionTokenCodec,
  type DailyProgressionClaims,
} from './dailyProgressionToken';
import {
  DailyRuntimeRequestError,
  createDailyRuntimeService,
} from './dailyRuntimeService';

const answerId = 'ibp_ab000000000000000000';
const otherId = 'ibp_cd000000000000000000';
const legacyId = 'chadwick:answer';
const answerName = 'Hidden Answer';
const revealMarker = 'FULL_REVEAL_MARKER';
const firstHintMarker = 'FIRST_ACTIVE_HINT_MARKER';
const secondHintMarker = 'SECOND_FUTURE_HINT_MARKER';
const date = '2026-07-22';
const tokens = createDailyProgressionTokenCodec('daily-runtime-service-test-secret-0123456789');
const service = createDailyRuntimeService({
  canonicalRuntime: buildRuntime(),
  createPuzzle: async puzzleDate => buildPuzzle(puzzleDate),
  progressionTokens: tokens,
});

describe('Daily canonical runtime service', () => {
  it('bootstraps only the first active batter bundle and signed reveal checkpoints', async () => {
    const bootstrap = await service.getBootstrap(date);
    const serialized = JSON.stringify(bootstrap);

    expect(bootstrap.puzzle.pitches).toHaveLength(9);
    expect(bootstrap.puzzle.pitches[0]).toEqual({ pitchNumber: 1, initials: 'HA' });
    expect(tokens.verify(bootstrap.progressionToken)).toEqual(initialClaims());
    expect(bootstrap.hintBundle).toMatchObject({
      pitchNumber: 1,
      revealedCount: 0,
      hints: [
        { slot: 1, hintType: 'main_decade', hintValue: firstHintMarker },
        { slot: 2, hintType: 'teams' },
        { slot: 3, hintType: 'position' },
        { slot: 4, hintType: 'stats' },
      ],
    });
    expect(bootstrap.hintBundle.checkpoints.map(checkpoint => checkpoint.revealedCount)).toEqual([1, 2, 3, 4]);
    for (const checkpoint of bootstrap.hintBundle.checkpoints) {
      expect(tokens.verify(checkpoint.progressionToken)).toEqual({
        ...initialClaims(),
        revealCount: checkpoint.revealedCount,
      });
    }

    expect(serialized).toContain(firstHintMarker);
    expect(serialized).not.toContain(secondHintMarker);
    expect(serialized).not.toContain(answerId);
    expect(serialized).not.toContain(legacyId);
    expect(serialized).not.toContain(answerName);
    expect(serialized).not.toContain(revealMarker);
  });

  it('hydrates an authorized current bundle without lower-depth checkpoints', async () => {
    const claims = {
      ...initialClaims(),
      revealCount: 2 as const,
      strikeCount: 1 as const,
    };
    const response = await service.getHintBundle(tokens.sign(claims));

    expect(response.hintBundle).toMatchObject({
      pitchNumber: 1,
      revealedCount: 2,
    });
    expect(response.hintBundle.checkpoints.map(checkpoint => checkpoint.revealedCount)).toEqual([3, 4]);
    for (const checkpoint of response.hintBundle.checkpoints) {
      expect(tokens.verify(checkpoint.progressionToken)).toEqual({
        ...claims,
        revealCount: checkpoint.revealedCount,
      });
    }
  });

  it('keeps the legacy one-hint route compatible with bundle checkpoints', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.revealHint(bootstrap.progressionToken);

    expect(response.hint).toEqual({
      hintType: 'main_decade',
      hintLabel: 'Main decade played in',
      hintValue: firstHintMarker,
    });
    expect(tokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      revealCount: 1,
    });
  });

  it('rejects hint requests beyond the configured maximum', async () => {
    await expect(service.revealHint(tokens.sign({
      ...initialClaims(),
      revealCount: 4,
    }))).rejects.toThrow(/No additional hint/);
  });

  it('returns no reveal and a refreshed same-pitch bundle after an incorrect guess', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      submittedPlayerId: otherId,
    });

    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(tokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      strikeCount: 1,
    });
    expect(response.hintBundle).toMatchObject({ pitchNumber: 1, revealedCount: 0 });
    for (const checkpoint of response.hintBundle?.checkpoints ?? []) {
      expect(tokens.verify(checkpoint.progressionToken)).toMatchObject({
        pitchNumber: 1,
        strikeCount: 1,
        revealCount: checkpoint.revealedCount,
      });
    }
    expect(JSON.stringify(response)).not.toContain(answerName);
    expect(JSON.stringify(response)).not.toContain(revealMarker);
  });

  it('uses the checkpoint hint depth for a correct outcome and supplies the next batter bundle', async () => {
    const bootstrap = await service.getBootstrap(date);
    const firstCheckpoint = requireCheckpoint(bootstrap.hintBundle.checkpoints, 1);
    const response = await service.resolveAtBat({
      progressionToken: firstCheckpoint.progressionToken,
      submittedPlayerId: answerId,
    });

    expect(response.result).toMatchObject({ kind: 'correct', outcome: '3B' });
    expect(response.reveal).toMatchObject({ playerId: answerId, displayName: answerName });
    expect(tokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      pitchNumber: 2,
    });
    expect(response.hintBundle).toMatchObject({
      pitchNumber: 2,
      revealedCount: 0,
    });
    expect(response.hintBundle?.hints).toHaveLength(4);
    expect(response.hintBundle?.hints[0]).toMatchObject({
      slot: 1,
      hintType: 'main_decade',
      hintValue: secondHintMarker,
    });
  });

  it('accepts a valid legacy selected ID through the canonical redirect boundary', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      submittedPlayerId: legacyId,
    });
    expect(response.result.kind).toBe('correct');
  });

  it('rejects invalid progression, unknown submitted IDs, and puzzle mismatches', async () => {
    await expect(service.getHintBundle('invalid')).rejects.toBeInstanceOf(DailyRuntimeRequestError);
    const bootstrap = await service.getBootstrap(date);
    await expect(service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      submittedPlayerId: 'unknown',
    })).rejects.toBeInstanceOf(DailyRuntimeRequestError);
    await expect(service.getHintBundle(tokens.sign({
      ...initialClaims(),
      puzzleId: 'daily-2026-07-21',
    }))).rejects.toThrow(/does not match its puzzle/);
  });

  it('returns the reveal, increments outs, and supplies the next bundle after a third strike', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({
        ...initialClaims(),
        revealCount: 2,
        strikeCount: 2,
      }),
      submittedPlayerId: otherId,
    });

    expect(response.result).toMatchObject({ kind: 'strikeout', strikeCount: 3 });
    expect(response.reveal?.displayName).toBe(answerName);
    expect(tokens.verify(response.progressionToken)).toEqual({
      ...initialClaims(),
      pitchNumber: 2,
      outCount: 1,
    });
    expect(response.hintBundle?.pitchNumber).toBe(2);
  });

  it('keeps Give Up terminal and prepares the next at-bat', async () => {
    const bootstrap = await service.getBootstrap(date);
    const response = await service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      giveUp: true,
    });

    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe(answerName);
    expect(tokens.verify(response.progressionToken)).toMatchObject({
      pitchNumber: 2,
      revealCount: 0,
      strikeCount: 0,
      outCount: 1,
      completed: false,
    });
    expect(response.hintBundle?.pitchNumber).toBe(2);
  });

  it('continues the current points policy after a third recorded out', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({ ...initialClaims(), outCount: 2 }),
      giveUp: true,
    });
    expect(tokens.verify(response.progressionToken)).toMatchObject({
      rulesetVersion: CURRENT_DAILY_RULESET_VERSION,
      outCount: 3,
      completed: false,
      pitchNumber: 2,
    });
    expect(response.hintBundle?.pitchNumber).toBe(2);
  });

  it('preserves points-v1 continuation for existing signed sessions', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({
        ...initialClaims(),
        rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
        outCount: 2,
      }),
      giveUp: true,
    });
    expect(tokens.verify(response.progressionToken)).toMatchObject({
      rulesetVersion: POINTS_V1_DAILY_RULESET_VERSION,
      outCount: 3,
      completed: false,
      pitchNumber: 2,
    });
  });

  it('preserves legacy three-out completion and returns no future bundle', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({
        ...initialClaims(),
        rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
        outCount: 2,
      }),
      giveUp: true,
    });

    expect(tokens.verify(response.progressionToken)).toMatchObject({
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
      outCount: 3,
      completed: true,
      pitchNumber: 1,
    });
    expect(response.hintBundle).toBeNull();
    await expect(service.getHintBundle(response.progressionToken)).rejects.toThrow(/already complete/);
  });

  it('returns no bundle after the ninth scheduled pitch', async () => {
    const response = await service.resolveAtBat({
      progressionToken: tokens.sign({ ...initialClaims(), pitchNumber: 9 }),
      submittedPlayerId: answerId,
    });

    expect(tokens.verify(response.progressionToken)).toMatchObject({
      pitchNumber: 9,
      completed: true,
    });
    expect(response.hintBundle).toBeNull();
  });
});

function initialClaims(): DailyProgressionClaims {
  return {
    version: 1,
    rulesetVersion: CURRENT_DAILY_RULESET_VERSION,
    puzzleId: `daily-${date}`,
    puzzleDate: date,
    pitchNumber: 1,
    revealCount: 0,
    strikeCount: 0,
    outCount: 0,
    completed: false,
  };
}

function requireCheckpoint(
  checkpoints: Array<{ revealedCount: number; progressionToken: string }>,
  revealedCount: number,
) {
  const checkpoint = checkpoints.find(candidate => candidate.revealedCount === revealedCount);
  if (checkpoint === undefined) {
    throw new Error(`Missing checkpoint ${revealedCount}.`);
  }
  return checkpoint;
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
      player: {
        playerId: legacyId,
        fullName: 'Hidden Legal Answer',
        displayName: answerName,
        initials: 'HA',
        kind: 'hitter' as const,
        primaryPosition: '1B',
      },
      hints: {
        main_decade: index === 0
          ? firstHintMarker
          : index === 1
            ? secondHintMarker
            : `FUTURE_HINT_${index + 1}`,
        teams: `TEAM_HINT_${index + 1}`,
        position: '1B',
        stats: `STATS_HINT_${index + 1}`,
      },
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
      redirects: { [legacyId]: answerId },
      excludedRedirects: [],
    },
    loadRevealShard: path => {
      const playerId = path.includes('/ab.') ? answerId : otherId;
      return {
        schemaVersion: 1,
        shardId: playerId.slice(4, 6),
        players: {
          [playerId]: {
            schemaVersion: 1,
            playerId,
            lahmanPlayerId: playerId === answerId ? 'answer01' : 'other01',
            displayName: playerId === answerId ? answerName : 'Other Player',
            playerType: 'hitter',
            career: {
              firstSeason: 2000,
              lastSeason: 2000,
              seasonCount: 1,
              teamIds: ['AAA'],
              primaryPosition: '1B',
              batting: null,
              pitching: null,
              advanced: null,
              achievements: { marker: revealMarker },
            },
            seasons: [],
            provenance: {
              canonicalUniversePresent: true,
              careerEnrichmentPresent: true,
              seasonCardCount: 0,
              legalNameExcludedFromDisplayPayload: true,
            },
          },
        },
      };
    },
  });
}
