import { createCanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import { createDailyRuntimeService } from './dailyRuntimeService';

const canonicalPlayerId = 'ibp_ab000000000000000000';
const legacyPlayerId = 'chadwick:answer';
const answerName = 'Hidden Answer';
const fullRevealMarker = 'FULL_REVEAL_MARKER';
const puzzle = buildPuzzle(1);
const service = createDailyRuntimeService({
  canonicalRuntime: buildCanonicalRuntime(),
  createPuzzle: () => puzzle,
});

describe('Daily canonical runtime service', () => {
  it('publishes only puzzle metadata, initials, and an opaque progression token', () => {
    const session = service.getPublicSession('2026-07-20');
    const serialized = JSON.stringify(session);

    expect(session.puzzle.pitches).toEqual([{ pitchNumber: 1, initials: 'HA' }]);
    expect(session.progressionToken).toEqual(expect.any(String));
    expect(serialized).not.toContain(canonicalPlayerId);
    expect(serialized).not.toContain(legacyPlayerId);
    expect(serialized).not.toContain(answerName);
    expect(serialized).not.toContain('Career marker');
    expect(serialized).not.toContain(fullRevealMarker);
  });

  it('releases only the requested hint and advances the signed hint state', () => {
    const session = service.getPublicSession('2026-07-20');
    const response = service.revealHint({
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

  it('uses server-verified hint depth for the correct outcome', () => {
    const session = service.getPublicSession('2026-07-20');
    const hintResponse = service.revealHint({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
    });
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: hintResponse.progressionToken,
      submittedPlayerId: canonicalPlayerId,
    });

    expect(response.result).toMatchObject({ kind: 'correct', outcome: '3B' });
  });

  it('returns no reveal data for an unresolved incorrect guess', () => {
    const session = service.getPublicSession('2026-07-20');
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: 'ibp_cd000000000000000000',
    });

    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(response.progressionToken).toEqual(expect.any(String));
    expect(JSON.stringify(response)).not.toContain(answerName);
    expect(JSON.stringify(response)).not.toContain(fullRevealMarker);
  });

  it('matches canonical identity and loads the reveal only after a correct guess', () => {
    const session = service.getPublicSession('2026-07-20');
    const response = service.resolveAtBat({
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

  it('accepts a valid legacy selected ID through the explicit redirect boundary', () => {
    const session = service.getPublicSession('2026-07-20');
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      submittedPlayerId: legacyPlayerId,
    });

    expect(response.result.kind).toBe('correct');
  });

  it('returns the reveal only when three verified incorrect guesses produce a strikeout', () => {
    const session = service.getPublicSession('2026-07-20');
    const first = submitIncorrectGuess(session.progressionToken);
    const second = submitIncorrectGuess(requireToken(first.progressionToken));
    const third = submitIncorrectGuess(requireToken(second.progressionToken));

    expect(first.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(second.result).toMatchObject({ kind: 'incorrect', strikeCount: 2 });
    expect(third.result).toMatchObject({ kind: 'strikeout', strikeCount: 3 });
    expect(third.reveal?.displayName).toBe(answerName);
    expect(third.progressionToken).toBeNull();
  });

  it('reveals only when Give Up safely resolves the current at-bat', () => {
    const session = service.getPublicSession('2026-07-20');
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      giveUp: true,
    });

    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe(answerName);
  });

  it('rejects tampered or cross-date progression tokens', () => {
    const session = service.getPublicSession('2026-07-20');

    expect(() => service.revealHint({
      puzzleDate: '2026-07-20',
      progressionToken: `${session.progressionToken}tampered`,
    })).toThrow('Invalid or stale Daily progression token');

    expect(() => service.revealHint({
      puzzleDate: '2026-07-21',
      progressionToken: session.progressionToken,
    })).toThrow('Invalid or stale Daily progression token');
  });

  it('cannot advance beyond the third verified out', () => {
    const fourPitchService = createDailyRuntimeService({
      canonicalRuntime: buildCanonicalRuntime(),
      createPuzzle: () => buildPuzzle(4),
    });
    const session = fourPitchService.getPublicSession('2026-07-20');
    const first = fourPitchService.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: session.progressionToken,
      giveUp: true,
    });
    const second = fourPitchService.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: requireToken(first.progressionToken),
      giveUp: true,
    });
    const third = fourPitchService.resolveAtBat({
      puzzleDate: '2026-07-20',
      progressionToken: requireToken(second.progressionToken),
      giveUp: true,
    });

    expect(first.progressionToken).toEqual(expect.any(String));
    expect(second.progressionToken).toEqual(expect.any(String));
    expect(third.progressionToken).toBeNull();
  });
});

function submitIncorrectGuess(progressionToken: string) {
  return service.resolveAtBat({
    puzzleDate: '2026-07-20',
    progressionToken,
    submittedPlayerId: 'ibp_cd000000000000000000',
  });
}

function requireToken(token: string | null): string {
  if (token === null) {
    throw new Error('Expected a continuation token.');
  }
  return token;
}

function buildPuzzle(pitchCount: number): DailyPuzzle {
  return {
    id: 'daily-2026-07-20',
    puzzleNumber: 85,
    puzzleDate: '2026-07-20',
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
  const otherPlayerId = 'ibp_cd000000000000000000';
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
