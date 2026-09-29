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

describe('Archive beta issued-puzzle reads', () => {
  it('reads by exact beta number/date and returns defensive copies', async () => {
    const puzzle = createPuzzle('2026-09-29');
    const repository = repo({ byNumber: puzzle, byDate: puzzle });
    const service = createArchiveBetaDailyIssuedPuzzleReadService(repository);

    const byNumber = await service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 1,
    });
    const byDate = await service.getByDate({
      seriesVersion: 'archive-beta-v1',
      puzzleDate: '2026-09-29',
    });

    expect(byNumber).toEqual(puzzle);
    expect(byDate).toEqual(puzzle);
    expect(byNumber).not.toBe(puzzle);
    expect(byNumber?.identity).not.toBe(puzzle.identity);
    expect(byNumber?.clueSnapshot).not.toBe(puzzle.clueSnapshot);
  });

  it('returns null for unissued identity and rejects wrong series before provider access', async () => {
    const repository = repo({});
    const service = createArchiveBetaDailyIssuedPuzzleReadService(repository);

    await expect(service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 2,
    })).resolves.toBeNull();

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1' as 'archive-beta-v1',
      dailyNumber: 1,
    })).rejects.toThrow(
      'Unsupported Archive beta Daily series version: permanent-v1.',
    );
  });

  it('fails closed when the provider returns a different beta identity', async () => {
    const service = createArchiveBetaDailyIssuedPuzzleReadService(
      repo({ byNumber: createPuzzle('2026-09-30') }),
    );

    await expect(service.getByNumber({
      seriesVersion: 'archive-beta-v1',
      dailyNumber: 1,
    })).rejects.toThrow('different number identity');
  });
});

function repo({
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
  const players = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

  return createArchiveBetaDailyClueFrozenIssuedPuzzle({
    identity,
    canonicalPlayerIds: players,
    clueSnapshot: createPermanentDailyIssuedClueSnapshot({
      hintLayout: [
        { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
        { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
        { slot: 3, hintType: 'position', displayLabel: 'Position' },
        { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
      ],
      pitches: players.map((canonicalPlayerId, index) => ({
        pitchNumber: index + 1,
        canonicalPlayerId,
        initials: `P${index + 1}`,
        hintValues: ['2000s', 'SEA, CIN', index === 8 ? 'P' : 'CF', 'Career stats'],
      })),
    }),
    issuedAt: `${puzzleDate}T07:00:00.000Z`,
  });
}
