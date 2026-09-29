import { describe, expect, it } from 'vitest';
import type { DailyEditorialSelection } from './dailyPuzzleLifecycle';
import {
  createArchiveBetaDailyClueFrozenIssuanceService,
  type ArchiveBetaDailyIssuanceEditorialPuzzle,
} from './archiveBetaDailyIssuance';
import {
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type ArchiveBetaDailyIssuedPuzzleRepository,
} from './archiveBetaDailyIssuedPuzzle';
import {
  createArchiveBetaDailyEpoch,
  resolveArchiveBetaDailyIdentityForDate,
} from './archiveBetaDailyIdentity';
import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';

const PLAYERS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

describe('Archive beta Daily clue-frozen issuance orchestration', () => {
  it('freezes scheduled editorial content in exact slot order as beta schema v2', async () => {
    const repository = new InMemoryRepository();
    const service = createArchiveBetaDailyClueFrozenIssuanceService(repository);

    const result = await service.issue({
      identity: identity('2026-09-29'),
      editorialPuzzle: editorial('2026-09-29', 'scheduled', selections().reverse()),
      clueSnapshot: clues(),
      issuedAt: '2026-09-29T07:00:00.000Z',
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      puzzle: {
        schemaVersion: 2,
        puzzleId: 'archive-beta-v1-daily-1',
        canonicalPlayerIds: PLAYERS,
      },
    });
  });

  it('accepts published content and preserves first issue time on exact retry', async () => {
    const repository = new InMemoryRepository();
    const service = createArchiveBetaDailyClueFrozenIssuanceService(repository);
    const input = {
      identity: identity('2026-09-29'),
      editorialPuzzle: editorial('2026-09-29', 'published'),
      clueSnapshot: clues(),
    };

    await service.issue({ ...input, issuedAt: '2026-09-29T07:00:00.000Z' });
    const retry = await service.issue({
      ...input,
      issuedAt: '2026-09-29T08:00:00.000Z',
    });

    expect(retry).toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: '2026-09-29T07:00:00.000Z' },
    });
  });

  it('fails before persistence on draft content, wrong date, or malformed slots', async () => {
    for (const puzzle of [
      editorial('2026-09-29', 'draft'),
      editorial('2026-09-30', 'scheduled'),
      editorial('2026-09-29', 'scheduled', [
        ...selections().slice(0, 8),
        { ...selections()[8]!, slot: 8 },
      ]),
    ]) {
      const repository = new InMemoryRepository();
      const service = createArchiveBetaDailyClueFrozenIssuanceService(repository);

      await expect(service.issue({
        identity: identity('2026-09-29'),
        editorialPuzzle: puzzle,
        clueSnapshot: clues(),
        issuedAt: '2026-09-29T07:00:00.000Z',
      })).rejects.toThrow();

      expect(repository.insertCalls).toBe(0);
    }
  });
});

function identity(puzzleDate: string) {
  const value = resolveArchiveBetaDailyIdentityForDate(
    puzzleDate,
    createArchiveBetaDailyEpoch('2026-09-29'),
  );
  if (value === null) throw new Error('Expected archive beta identity.');
  return value;
}

function editorial(
  puzzleDate: string,
  status: ArchiveBetaDailyIssuanceEditorialPuzzle['status'],
  selected: readonly DailyEditorialSelection[] = selections(),
): ArchiveBetaDailyIssuanceEditorialPuzzle {
  return { puzzleDate, status, selections: selected };
}

function selections(): DailyEditorialSelection[] {
  return PLAYERS.map((canonicalPlayerId, index) => ({
    slot: index + 1,
    canonicalPlayerId,
    source: 'generated',
  }));
}

function clues() {
  return createPermanentDailyIssuedClueSnapshot({
    hintLayout: [
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ],
    pitches: PLAYERS.map((canonicalPlayerId, index) => ({
      pitchNumber: index + 1,
      canonicalPlayerId,
      initials: `P${index + 1}`,
      hintValues: ['2000s', 'NYY, BOS', index === 8 ? 'P' : 'CF', 'Career stats'],
    })),
  });
}

class InMemoryRepository implements ArchiveBetaDailyIssuedPuzzleRepository {
  stored: ArchiveBetaDailyClueFrozenIssuedPuzzle | null = null;
  insertCalls = 0;

  async insertIfAbsent(puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle) {
    this.insertCalls += 1;
    if (this.stored !== null) {
      return { status: 'existing' as const, puzzle: this.stored };
    }
    this.stored = puzzle;
    return { status: 'inserted' as const, puzzle };
  }
}
