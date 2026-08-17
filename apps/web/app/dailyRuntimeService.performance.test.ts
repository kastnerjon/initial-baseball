import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createDailyRuntimeService } from './dailyRuntimeService';

const answerId = 'ibp_ab000000000000000000';
const otherId = 'ibp_cd000000000000000000';
const nonexistentCanonicalId = 'ibp_ef000000000000000000';
const date = '2026-08-16';

describe('Daily resolution hot path', () => {
  it('does not initialize legacy resolution or reveal data for ordinary canonical misses', async () => {
    const resolveLegacyPlayerId = vi.fn<(playerId: string) => string>();
    const getCanonicalReveal = vi.fn<(playerId: string) => CanonicalPlayerReveal>();
    const service = createService(resolveLegacyPlayerId, getCanonicalReveal);
    const bootstrap = await service.getBootstrap(date);

    const response = await service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      submittedPlayerId: otherId,
    });

    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(response.reveal).toBeNull();
    expect(resolveLegacyPlayerId).not.toHaveBeenCalled();
    expect(getCanonicalReveal).not.toHaveBeenCalled();
  });

  it('uses the narrow reveal reader for terminal canonical resolution without legacy lookup', async () => {
    const resolveLegacyPlayerId = vi.fn<(playerId: string) => string>();
    const getCanonicalReveal = vi.fn<(playerId: string) => CanonicalPlayerReveal>(() => buildReveal());
    const service = createService(resolveLegacyPlayerId, getCanonicalReveal);
    const bootstrap = await service.getBootstrap(date);

    const response = await service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      submittedPlayerId: answerId,
    });

    expect(response.result.kind).toBe('correct');
    expect(response.reveal?.playerId).toBe(answerId);
    expect(resolveLegacyPlayerId).not.toHaveBeenCalled();
    expect(getCanonicalReveal).toHaveBeenCalledWith(answerId);
  });

  it('treats a well-formed unknown canonical ID as an ordinary incorrect anonymous guess', async () => {
    const resolveLegacyPlayerId = vi.fn<(playerId: string) => string>();
    const getCanonicalReveal = vi.fn<(playerId: string) => CanonicalPlayerReveal>();
    const service = createService(resolveLegacyPlayerId, getCanonicalReveal);
    const bootstrap = await service.getBootstrap(date);

    const response = await service.resolveAtBat({
      progressionToken: bootstrap.progressionToken,
      submittedPlayerId: nonexistentCanonicalId,
    });

    expect(response.result).toMatchObject({ kind: 'incorrect', strikeCount: 1 });
    expect(resolveLegacyPlayerId).not.toHaveBeenCalled();
  });
});

function createService(
  resolveLegacyPlayerId: (playerId: string) => string,
  getCanonicalReveal: (playerId: string) => CanonicalPlayerReveal,
) {
  return createDailyRuntimeService({
    resolveLegacyPlayerId,
    getCanonicalReveal,
    createPuzzle: async puzzleDate => buildPuzzle(puzzleDate),
    progressionTokens: createDailyProgressionTokenCodec('performance-test-secret-0123456789012345'),
  });
}

function buildPuzzle(puzzleDate: string): DailyPuzzle {
  return {
    id: `daily-${puzzleDate}`,
    puzzleNumber: 112,
    puzzleDate,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      player: {
        playerId: answerId,
        fullName: 'Hidden Answer',
        displayName: 'Hidden Answer',
        initials: 'HA',
        kind: 'hitter' as const,
        primaryPosition: '1B',
      },
      hints: {
        main_decade: '2000s',
        teams: 'AAA',
        position: '1B',
        stats: 'HR 100',
      },
    })),
  };
}

function buildReveal(): CanonicalPlayerReveal {
  return {
    schemaVersion: 1,
    playerId: answerId,
    lahmanPlayerId: 'answer01',
    displayName: 'Hidden Answer',
    playerType: 'hitter',
    career: {
      firstSeason: 2000,
      lastSeason: 2001,
      seasonCount: 2,
      teamIds: ['AAA'],
      primaryPosition: '1B',
      batting: null,
      pitching: null,
      advanced: null,
      achievements: null,
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
