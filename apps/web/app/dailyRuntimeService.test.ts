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
const puzzle = buildPuzzle();
const service = createDailyRuntimeService({
  canonicalRuntime: buildCanonicalRuntime(),
  createPuzzle: () => puzzle,
});

describe('Daily canonical runtime service', () => {
  it('publishes only puzzle metadata and initials before resolution', () => {
    const publicPuzzle = service.getPublicPuzzle('2026-07-20');
    const serialized = JSON.stringify(publicPuzzle);

    expect(publicPuzzle.pitches).toEqual([{ pitchNumber: 1, initials: 'HA' }]);
    expect(serialized).not.toContain(canonicalPlayerId);
    expect(serialized).not.toContain(legacyPlayerId);
    expect(serialized).not.toContain(answerName);
    expect(serialized).not.toContain('Career marker');
    expect(serialized).not.toContain(fullRevealMarker);
  });

  it('releases only the requested hint and no answer identity', () => {
    const response = service.revealHint('2026-07-20', 1, 0);
    expect(response).toEqual({
      hint: {
        hintType: 'main_decade',
        hintLabel: 'Main decade played in',
        hintValue: '2000s',
      },
    });
    expect(JSON.stringify(response)).not.toContain(canonicalPlayerId);
    expect(JSON.stringify(response)).not.toContain(answerName);
  });

  it('returns no reveal data for an unresolved incorrect guess', () => {
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      pitchNumber: 1,
      revealCount: 0,
      strikeCount: 0,
      submittedPlayerId: 'ibp_cd000000000000000000',
    });
    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(JSON.stringify(response)).not.toContain(answerName);
    expect(JSON.stringify(response)).not.toContain(fullRevealMarker);
  });

  it('matches canonical identity and loads the reveal only after a correct guess', () => {
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      pitchNumber: 1,
      revealCount: 1,
      strikeCount: 0,
      submittedPlayerId: canonicalPlayerId,
    });
    expect(response.result).toMatchObject({ kind: 'correct', outcome: '3B' });
    expect(response.reveal).toMatchObject({ playerId: canonicalPlayerId, displayName: answerName });
  });

  it('accepts a valid legacy selected ID through the explicit redirect boundary', () => {
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      pitchNumber: 1,
      revealCount: 0,
      strikeCount: 0,
      submittedPlayerId: legacyPlayerId,
    });
    expect(response.result.kind).toBe('correct');
  });

  it('returns the reveal when an incorrect guess becomes the third strike', () => {
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      pitchNumber: 1,
      revealCount: 2,
      strikeCount: 2,
      submittedPlayerId: 'ibp_cd000000000000000000',
    });
    expect(response.result).toMatchObject({ kind: 'strikeout', strikeCount: 3 });
    expect(response.reveal?.displayName).toBe(answerName);
  });

  it('reveals only when Give Up safely resolves the at-bat', () => {
    const response = service.resolveAtBat({
      puzzleDate: '2026-07-20',
      pitchNumber: 1,
      revealCount: 2,
      strikeCount: 0,
      giveUp: true,
    });
    expect(response.result).toMatchObject({ kind: 'strikeout', outcome: 'K' });
    expect(response.reveal?.displayName).toBe(answerName);
  });
});

function buildPuzzle(): DailyPuzzle {
  return {
    id: 'daily-2026-07-20',
    puzzleNumber: 85,
    puzzleDate: '2026-07-20',
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: [{
      pitchNumber: 1,
      player: {
        playerId: legacyPlayerId,
        fullName: 'Hidden Legal Answer',
        displayName: answerName,
        initials: 'HA',
        kind: 'hitter',
        primaryPosition: '1B',
      },
      hints: {
        main_decade: '2000s',
        teams: 'AAA',
        position: '1B',
        stats: 'Career marker',
      },
    }],
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
