import { describe, expect, it, vi } from 'vitest';
import {
  createArchiveBetaDailyEpoch,
  resolveArchiveBetaDailyIdentityForDate,
} from './archiveBetaDailyIdentity';
import {
  createArchiveBetaDailyClueFrozenIssuedPuzzle,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
} from './archiveBetaDailyIssuedPuzzle';
import {
  createArchiveBetaDailyIssuedPuzzleReadService,
  type ArchiveBetaDailyIssuedPuzzleReadRepository,
} from './archiveBetaDailyIssuedPuzzleRead';
import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';

const PUZZLE = createPuzzle('2026-09-29');

describe('Archive beta issued-puzzle reads', () => {
  it('reads one clue-frozen beta puzzle by exact series and Daily number', async () => {
    const repository = createRepository({ byNumber: PUZZLE });
    const service = createArchiveBetaDailyIssuedPuzzleReadService(repository);

    const result = await service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 1,
    });

    expect(result).toEqual(PUZZLE);
    expect(repository.getByNumber).toHaveBeenCalledWith({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 1,
    });
  });

  it('reads by exact beta series and puzzle date', async () => {
    const repository = createRepository({ byDate: PUZZLE });
    const service = createArchiveBetaDailyIssuedPuzzleReadService(repository);

    const result = await service.getByDate({
      seriesVersion: 'archive-beta-v1',
      puzzleDate: '2026-09-29',
    });

    expect(result).toEqual(PUZZLE);
  });

  it('returns null for an unissued beta identity', async () => {
    const service = createArchiveBetaDailyIssuedPuzzleReadService(createRepository({}));

    await expect(service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 2,
    })).resolves.toBeNull();
  });

  it('rejects a non-beta series before invoking the provider', async () => {
    const repository = createRepository({});
    const service = createArchiveBetaDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1' as 'archive-beta-v1',
      dailyNumber: 1,
    })).rejects.toThrow(
      'Unsupported Archive beta Daily series version: permanent-v1.',
    );

    expect(repository.getByNumber).not.toHaveBeenCalled();
  });

  it('fails closed when the provider returns a different beta identity', async () => {
    const repository = createRepository({ byNumber: createPuzzle('2026-09-30') });
    const service = createArchiveBetaDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 1,
    })).rejects.toThrow('different number identity');
  });

  it('returns a defensive nested copy', async () => {
    const service = createArchiveBetaDailyIssuedPuzzleReadService(
      createRepository({ byNumber: PUZZLE }),
    );

    const result = await service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 1,
    });
    if (result === null) throw new Error('Expected archive beta puzzle.');

    expect(result).not.toBe(PUZZLE);
    expect(result.identity).not.toBe(PUZZLE.identity);
    expect(result.canonicalPlayerIds).not.toBe(PUZZLE.canonicalPlayerIds);
    expect(result.clueSnapshot).not.toBe(PUZZLE.clueSnapshot);
  });
});

function createRepository({
  byNumber = null,
  byDate = null,
}: {
  byNumber?: ArchiveBetaDailyClueFrozenIssuedPuzzle | null;
  byDate?: ArchiveBetaDailyClueFrozenIssuedPuzzle | null;
}): ArchiveBetaDailyIssuedPuzzleReadRepository & {
  getByNumber: ReturnType<typeof vi.fn>;
  getByDate: ReturnType<typeof vi.fn>;
} {
  return {
    getByNumber: vi.fn().mockResolvedValue(byNumber),
    getByDate: vi.fn().mockResolvedValue(byDate),
  };
}

function createPuzzle(puzzleDate: string): ArchiveBetaDailyClueFrozenIssuedPuzzle {
  const identity = resolveArchiveBetaDailyIdentityForDate(
    puzzleDate,
    createArchiveBetaDailyEpoch('2026-09-29'),
  );
  if (identity === null) throw new Error('Expected archive beta identity.');

  const canonicalPlayerIds = Array.from(
    { length: 9 },
    (_, index) => `player-${index + 1}`,
  );

  return createArchiveBetaDailyClueFrozenIssuedPuzzle({
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
    issuedAt: `${puzzleDate}T07:00:00.000Z`,
  });
}
