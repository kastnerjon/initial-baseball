import { createCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { createInMemoryDailyProgressionReplayStore } from './dailyProgressionReplayStore';
import { createDailyRuntimeService } from './dailyRuntimeService';

const canonicalPlayerId = 'ibp_ab000000000000000000';
const legacyPlayerId = 'chadwick:answer';
const otherPlayerId = 'ibp_cd000000000000000000';
const answerName = 'Hidden Answer';
const fullRevealMarker = 'FULL_REVEAL_MARKER';
const service = createTestService(1);

describe('Daily canonical runtime service', () => {
  it('publishes only puzzle metadata, initials, and an opaque progression token', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const serialized = JSON.stringify(session);

    expect(session.puzzle.pitches).toEqual([{ pitchNumber: 1, initials: 'HA' }]);
    expect(session.progressionToken).toEqual(expect.any(String));
    expect(serialized).not.toContain(canonicalPlayerId);
    expect(serialized).not.toContain(legacyPlayerId);
    expect(serialized).not.toContain(answerName);
    expect(serialized).not.toContain('Career marker');
    expect(serialized).not.toContain(fullRevealMarker);
  });

  it('releases only the requested hint and advances the signed hint state', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const response = await service.revealHint({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
    });

    expect(response.hint).toEqual({
      hintType: 'main_decade',
      hintLabel: 'Main decade played in',
      hintValue: '2000s',
    });
    expect(response.progressionToken).not.toBe(session.progressionToken);
    expect(JSON.stringify(response)).not.toContain(canonicalPlayerId);
    expect(JSON.stringify(response)).not.toContain(answerName);
  });

  it('uses server-verified hint depth for the correct outcome', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const hintResponse = await service.revealHint({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
    });
    const response = await service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: hintResponse.progressionToken,
      submittedPlayerId: canonicalPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'correct', outcome: '3B' });
  });

  it('returns no reveal data for an unresolved incorrect guess', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const response = await service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: otherPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(response.progressionToken).toEqual(expect.any(String));
    expect(JSON.stringify(response)).not.toContain(answerName);
    expect(JSON.stringify(response)).not.toContain(fullRevealMarker);
  });

  it('matches canonical identity and loads the reveal only after a correct guess', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const response = await service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: canonicalPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'correct', outcome: 'HR' });
    expect(response.reveal).toMatchObject({
      playerId: canonicalPlayerId,
      displayName: answerName,
    });
    expect(response.progressionToken).toBeNull();
  });

  it('accepts a valid legacy selected ID through the explicit redirect boundary', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const response = await service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: legacyPlayerId,
    });

    expect(response.result.kind).toBe('correct');
  });

  it('returns the reveal only when three verified incorrect guesses produce a strikeout', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const first = await submitIncorrectGuess(session.progressionToken);
    const second = await submitIncorrectGuess(requireToken(first.progressionToken));
    const third = await submitIncorrectGuess(requireToken(second.progressionToken));

    expect(first.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(second.result).toMatchObject({ kind: 'incorrect', strikeCount: 2 });
    expect(third.result).toMatchObject({ kind: 'strikeout', strikeCount: 3 });
    expect(third.reveal?.displayName).toBe(answerName);
    expect(third.progressionToken).toBeNull();
  });

  it('returns the same response for an exact retried action', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const request = {
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: otherPlayerId,
    };

    const first = await service.resolveAtBat(request);
    const retry = await service.resolveAtBat(request);

    expect(retry).toEqual(first);
  });

  it('rejects a different action that reuses a consumed token', async () => {
    const session = await service.getPublicSession('2026-07-20');
    await service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: otherPlayerId,
    });

    await expect(service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: canonicalPlayerId,
    })).rejects.toThrow('already been consumed');
  });

  it('reveals only when Give Up safely resolves the current at-bat', async () => {
    const session = await service.getPublicSession('2026-07-20');
    const response = await service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      giveUp: true,
    });

    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe(answerName);
  });

  it('rejects tampered or cross-date progression tokens', async () => {
    const session = await service.getPublicSession('2026-07-20');

    await expect(service.revealHint({
      puzzleDate: '2026-07-20',
      progressionToken: `${session.progressionToken}tampered`,
    })).rejects.toThrow('Invalid or stale Daily progression token');

    await expect(service.revealHint({
      puzzleDate: '2026-07-21',
      progressionToken: session.progressionToken,
    })).rejects.toThrow('Invalid or stale Daily progression token');
  });

  it('cannot advance beyond the third verified out', async () => {
    const fourPitchService = createTestService(4);
    const session = await fourPitchService.getPublicSession('2026-07-20');
    const first = await fourPitchService.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      giveUp: true,
    });
    const second = await fourPitchService.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: requireToken(first.progressionToken),
      giveUp: true,
    });
    const third = await fourPitchService.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: requireToken(second.progressionToken),
      giveUp: true,
    });

    expect(first.progressionToken).toEqual(expect.any(String));
    expect(second.progressionToken).toEqual(expect.any(String));
    expect(third.progressionToken).toBeNull();
  });
});

function createTestService(pitchCount: number) {
  return createDailyRuntimeService({
    canonicalRuntime: buildCanonicalRuntime(),
    progressionReplayStore: createInMemoryDailyProgressionReplayStore(),
    createPuzzle: (date) => buildPuzzle(pitchCount, date),
  });
}

function submitIncorrectGuess(progressionToken: string) {
  return service.resolveAtBat({
    puzzleDate: '2026-07-20',
    progressionToken,
    submittedPlayerId: otherPlayerId,
  });
}

function requireToken(token: string | null): string {
  if (token === null) {
    throw new Error('Expected a continuation token.');
  }
  return token;
}

function buildPuzzle(pitchCount: number, puzzleDate: string): DailyPuzzle {
  return {
    id: `daily-${puzzleDate}`,
    puzzleNumber: 85,
    puzzleDate,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: pitchCount }, (_, index) => ({
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
      players: [canonicalPlayerId, otherPlayerId].map((playerId) => ({
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
