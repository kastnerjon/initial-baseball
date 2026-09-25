import {
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedClueSnapshot,
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRecord,
  type PermanentDailyIssuedPuzzleReadService,
} from '@initial-baseball/daily';
import type { DailyPuzzle } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createServerPermanentDailyArchivePuzzleSource,
} from './serverPermanentDailyArchivePuzzleSource';

const ISSUED_PUZZLE = createIssuedPuzzle();
const CLUE_FROZEN_ISSUED_PUZZLE = createClueFrozenIssuedPuzzle();
const MATERIALIZED_PUZZLE = {
  id: ISSUED_PUZZLE.puzzleId,
  puzzleNumber: ISSUED_PUZZLE.identity.dailyNumber,
  puzzleDate: ISSUED_PUZZLE.identity.puzzleDate,
  status: 'published',
  hintConfig: [],
  statsHintConfig: { hitter: [], pitcher: [] },
  pitches: [],
} satisfies DailyPuzzle;

describe('server permanent Daily archive puzzle source', () => {
  it('reads by number and materializes the frozen puzzle through one read service', async () => {
    const readService = createReadService({ byNumber: ISSUED_PUZZLE });
    const createReadServiceFactory = vi.fn(() => readService);
    const materializePuzzle = vi.fn(() => MATERIALIZED_PUZZLE);

    const source = createServerPermanentDailyArchivePuzzleSource({
      dependencies: {
        createReadService: createReadServiceFactory,
        materializePuzzle,
      },
    });

    await expect(source.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    })).resolves.toBe(MATERIALIZED_PUZZLE);

    expect(createReadServiceFactory).toHaveBeenCalledOnce();
    expect(readService.getByNumber).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    });
    expect(readService.getByDate).not.toHaveBeenCalled();
    expect(materializePuzzle).toHaveBeenCalledWith(ISSUED_PUZZLE);
  });

  it('reads by date and preserves not-issued null without materialization', async () => {
    const readService = createReadService({});
    const materializePuzzle = vi.fn(() => MATERIALIZED_PUZZLE);
    const source = createServerPermanentDailyArchivePuzzleSource({
      dependencies: {
        createReadService: vi.fn(() => readService),
        materializePuzzle,
      },
    });

    await expect(source.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-06',
    })).resolves.toBeNull();

    expect(readService.getByDate).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-06',
    });
    expect(materializePuzzle).not.toHaveBeenCalled();
  });

  it('passes a v2 clue snapshot intact to the materializer', async () => {
    const readService = createReadService({ byNumber: CLUE_FROZEN_ISSUED_PUZZLE });
    const materializePuzzle = vi.fn(() => MATERIALIZED_PUZZLE);
    const source = createServerPermanentDailyArchivePuzzleSource({
      dependencies: {
        createReadService: vi.fn(() => readService),
        materializePuzzle,
      },
    });

    await expect(source.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    })).resolves.toBe(MATERIALIZED_PUZZLE);

    expect(materializePuzzle).toHaveBeenCalledWith(CLUE_FROZEN_ISSUED_PUZZLE);
  });

  it('does not reinterpret reader failures', async () => {
    const readService = createReadService({});
    const failure = new Error('archive provider unavailable');
    readService.getByNumber.mockRejectedValue(failure);
    const materializePuzzle = vi.fn(() => MATERIALIZED_PUZZLE);
    const source = createServerPermanentDailyArchivePuzzleSource({
      dependencies: {
        createReadService: vi.fn(() => readService),
        materializePuzzle,
      },
    });

    await expect(source.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    })).rejects.toBe(failure);

    expect(materializePuzzle).not.toHaveBeenCalled();
  });

  it('does not reinterpret materialization failures', async () => {
    const readService = createReadService({ byDate: ISSUED_PUZZLE });
    const failure = new Error('canonical player unavailable');
    const source = createServerPermanentDailyArchivePuzzleSource({
      dependencies: {
        createReadService: vi.fn(() => readService),
        materializePuzzle: vi.fn(() => {
          throw failure;
        }),
      },
    });

    await expect(source.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: ISSUED_PUZZLE.identity.puzzleDate,
    })).rejects.toBe(failure);
  });
});

function createReadService({
  byNumber = null,
  byDate = null,
}: {
  byNumber?: PermanentDailyIssuedPuzzleRecord | null;
  byDate?: PermanentDailyIssuedPuzzleRecord | null;
}): PermanentDailyIssuedPuzzleReadService & {
  getByNumber: ReturnType<typeof vi.fn>;
  getByDate: ReturnType<typeof vi.fn>;
} {
  return {
    getByNumber: vi.fn().mockResolvedValue(byNumber),
    getByDate: vi.fn().mockResolvedValue(byDate),
  };
}

function createIssuedPuzzle(): PermanentDailyIssuedPuzzle {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');

  return createPermanentDailyIssuedPuzzle({
    identity,
    canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `canonical-player-${index + 1}`),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}

function createClueFrozenIssuedPuzzle() {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');
  const canonicalPlayerIds = Array.from({ length: 9 }, (_, index) => `canonical-player-${index + 1}`);

  return createPermanentDailyClueFrozenIssuedPuzzle({
    identity,
    canonicalPlayerIds,
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Frozen decade' },
        { slot: 2, hintType: 'teams', displayLabel: 'Frozen teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Frozen position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Frozen stats' },
      ],
      pitches: canonicalPlayerIds.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: `P${index + 1}`,
        hintValues: ['2000s', 'SEA, CIN', 'CF', 'HR 100'],
      })),
    }),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}
