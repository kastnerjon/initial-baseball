import { describe, expect, it, vi } from 'vitest';
import {
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyIssuedClueSnapshot,
  createPermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRecord,
} from './permanentDailyIssuedPuzzle';
import {
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
} from './permanentDailyIdentity';
import {
  createPermanentDailyIssuedPuzzleReadService,
  type PermanentDailyIssuedPuzzleReadRepository,
} from './permanentDailyIssuedPuzzleRead';

const PUZZLE = createPuzzle();

describe('Permanent Daily issued-puzzle reads', () => {
  it('reads one frozen puzzle by permanent series and Daily number', async () => {
    const repository = createRepository({ byNumber: PUZZLE });
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    const result = await service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    });

    expect(result).toEqual(PUZZLE);
    expect(repository.getByNumber).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    });
  });

  it('reads one frozen puzzle by permanent series and puzzle date', async () => {
    const repository = createRepository({ byDate: PUZZLE });
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    const result = await service.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-05',
    });

    expect(result).toEqual(PUZZLE);
    expect(repository.getByDate).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-05',
    });
  });

  it('returns null when the requested permanent puzzle has not been issued', async () => {
    const repository = createRepository({});
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 2,
    })).resolves.toBeNull();

    await expect(service.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-06',
    })).resolves.toBeNull();
  });

  it('rejects invalid queries before invoking the provider', async () => {
    const repository = createRepository({});
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 0,
    })).rejects.toThrow('positive safe integer');

    await expect(service.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-02-30',
    })).rejects.toThrow('not a valid calendar date');

    await expect(service.getByNumber({
      seriesVersion: 'future-series' as 'permanent-v1',
      dailyNumber: 1,
    })).rejects.toThrow('Unsupported Permanent Daily series version');

    expect(repository.getByNumber).not.toHaveBeenCalled();
    expect(repository.getByDate).not.toHaveBeenCalled();
  });

  it('fails closed when the provider returns a different number identity', async () => {
    const repository = createRepository({ byNumber: createPuzzle('2030-04-06') });
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    })).rejects.toThrow('different number identity');
  });

  it('fails closed when the provider returns a different date identity', async () => {
    const repository = createRepository({ byDate: createPuzzle('2030-04-06') });
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    await expect(service.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-05',
    })).rejects.toThrow('different date identity');
  });

  it('fails closed on schema v2 until frozen-clue archive materialization is wired', async () => {
    const repository = createRepository({ byNumber: createClueFrozenPuzzle() });
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    })).rejects.toThrow('not materializable until frozen-clue archive wiring is enabled');
  });

  it('returns a defensive copy of the provider value', async () => {
    const repository = createRepository({ byNumber: PUZZLE });
    const service = createPermanentDailyIssuedPuzzleReadService(repository);

    const result = await service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    });
    if (result === null) throw new Error('Expected issued puzzle.');

    expect(result).not.toBe(PUZZLE);
    expect(result.identity).not.toBe(PUZZLE.identity);
    expect(result.canonicalPlayerIds).not.toBe(PUZZLE.canonicalPlayerIds);
  });
});

function createRepository({
  byNumber = null,
  byDate = null,
}: {
  byNumber?: PermanentDailyIssuedPuzzleRecord | null;
  byDate?: PermanentDailyIssuedPuzzleRecord | null;
}): PermanentDailyIssuedPuzzleReadRepository & {
  getByNumber: ReturnType<typeof vi.fn>;
  getByDate: ReturnType<typeof vi.fn>;
} {
  return {
    getByNumber: vi.fn().mockResolvedValue(byNumber),
    getByDate: vi.fn().mockResolvedValue(byDate),
  };
}

function createPuzzle(puzzleDate = '2030-04-05'): PermanentDailyIssuedPuzzle {
  const epoch = createPermanentDailyLaunchEpoch('2030-04-05');
  const identity = resolvePermanentDailyIdentityForDate(puzzleDate, epoch);
  if (identity === null) throw new Error('Expected permanent identity.');

  return createPermanentDailyIssuedPuzzle({
    identity,
    canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `player-${index + 1}`),
    issuedAt: `${puzzleDate}T07:00:00.000Z`,
  });
}


function createClueFrozenPuzzle() {
  const canonicalPlayerIds = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent identity.');

  return createPermanentDailyClueFrozenIssuedPuzzle({
    identity,
    canonicalPlayerIds,
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: canonicalPlayerIds.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: `P${index + 1}`,
        hintValues: ['2000s', 'SEA, CIN', index === 8 ? 'P' : 'CF', 'Career stats'],
      })),
    }),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}
