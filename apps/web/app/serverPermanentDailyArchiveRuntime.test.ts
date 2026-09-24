import {
  CLASSIC_DAILY_RULESET_VERSION,
  CURRENT_DAILY_RULESET_VERSION,
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import {
  createServerPermanentDailyArchiveRuntime,
} from './serverPermanentDailyArchiveRuntime';
import type {
  ServerPermanentDailyArchivePuzzleSource,
} from './serverPermanentDailyArchivePuzzleSource';

const DATE = '2030-04-05';
const ANSWER_ID = 'ibp_ab000000000000000000';
const TOKENS = createDailyProgressionTokenCodec(
  'permanent-archive-runtime-test-secret-0123456789',
);
const PUZZLE = buildPuzzle();

describe('server permanent Daily archive runtime', () => {
  it('bootstraps the frozen permanent puzzle through the existing Daily runtime', async () => {
    const source = createSource(PUZZLE);
    const runtime = createRuntime(source);

    const bootstrap = await runtime.getBootstrap(DATE);

    expect(source.getByDate).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      puzzleDate: DATE,
    });
    expect(source.getByNumber).not.toHaveBeenCalled();
    expect(bootstrap.rulesetVersion).toBe(CURRENT_DAILY_RULESET_VERSION);
    expect(bootstrap.puzzle).toMatchObject({
      id: 'permanent-v1-daily-1',
      puzzleNumber: 1,
      puzzleDate: DATE,
      status: 'published',
    });
    expect(bootstrap.puzzle.pitches[0]).toEqual({
      pitchNumber: 1,
      initials: 'HA',
    });
    expect(TOKENS.verify(bootstrap.progressionToken)).toMatchObject({
      version: 1,
      rulesetVersion: CURRENT_DAILY_RULESET_VERSION,
      puzzleId: 'permanent-v1-daily-1',
      puzzleDate: DATE,
      pitchNumber: 1,
      revealCount: 0,
      strikeCount: 0,
      outCount: 0,
      completed: false,
    });
  });

  it('uses the caller-selected retained ruleset without choosing launch policy', async () => {
    const runtime = createRuntime(createSource(PUZZLE));

    const bootstrap = await runtime.getBootstrap(
      DATE,
      CLASSIC_DAILY_RULESET_VERSION,
    );

    expect(bootstrap.rulesetVersion).toBe(CLASSIC_DAILY_RULESET_VERSION);
    expect(TOKENS.verify(bootstrap.progressionToken)).toMatchObject({
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      puzzleId: 'permanent-v1-daily-1',
    });
  });

  it('fails closed when the requested permanent puzzle has not been issued', async () => {
    const source = createSource(null);
    const runtime = createRuntime(source);

    await expect(runtime.getBootstrap(DATE)).rejects.toEqual(
      expect.objectContaining({
        name: 'DailyRuntimeRequestError',
        message: `Permanent Daily puzzle ${DATE} has not been issued.`,
      }),
    );
    await expect(runtime.getPublicPuzzle(DATE)).rejects.toBeInstanceOf(
      DailyRuntimeRequestError,
    );
  });

  it('keeps signed progression bound to the permanent puzzle identity', async () => {
    const source = createSource(PUZZLE);
    source.getByDate
      .mockResolvedValueOnce(PUZZLE)
      .mockResolvedValueOnce({
        ...PUZZLE,
        id: 'permanent-v1-daily-2',
        puzzleNumber: 2,
      });
    const runtime = createRuntime(source);
    const bootstrap = await runtime.getBootstrap(DATE);

    await expect(
      runtime.getHintBundle(bootstrap.progressionToken),
    ).rejects.toThrow('does not match its puzzle');
  });
});

function createRuntime(source: ServerPermanentDailyArchivePuzzleSource) {
  return createServerPermanentDailyArchiveRuntime({
    source,
    progressionTokens: TOKENS,
    resolveLegacyPlayerId: playerId => playerId,
    getCanonicalReveal: () => {
      throw new Error('Reveal lookup is not expected in this composition test.');
    },
  });
}

function createSource(
  puzzle: DailyPuzzle | null,
): ServerPermanentDailyArchivePuzzleSource & {
  getByNumber: ReturnType<typeof vi.fn>;
  getByDate: ReturnType<typeof vi.fn>;
} {
  return {
    getByNumber: vi.fn().mockResolvedValue(puzzle),
    getByDate: vi.fn().mockResolvedValue(puzzle),
  };
}

function buildPuzzle(): DailyPuzzle {
  return {
    id: 'permanent-v1-daily-1',
    puzzleNumber: 1,
    puzzleDate: DATE,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      player: {
        playerId: ANSWER_ID,
        fullName: 'Hidden Answer',
        displayName: 'Hidden Answer',
        initials: 'HA',
        kind: 'hitter' as const,
        primaryPosition: '1B',
      },
      hints: {
        main_decade: '2000s',
        teams: 'NYY',
        position: '1B',
        stats: 'HR 200',
      },
    })),
  };
}
