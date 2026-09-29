import { describe, expect, it } from 'vitest';
import {
  createArchiveBetaDailyEpoch,
  resolveArchiveBetaDailyIdentityForDate,
  type ArchiveBetaDailyIdentity,
} from './archiveBetaDailyIdentity';
import {
  cloneArchiveBetaDailyClueFrozenIssuedPuzzle,
  createArchiveBetaDailyClueFrozenIssuedPuzzle,
  createArchiveBetaDailyClueFrozenIssuedPuzzleService,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type ArchiveBetaDailyIssuedPuzzleRepository,
  type ArchiveBetaDailyIssuedPuzzleRepositoryInsertResult,
} from './archiveBetaDailyIssuedPuzzle';
import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';

const PLAYERS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

describe('Archive beta clue-frozen issued puzzle', () => {
  it('creates a defensive schema-v2 puzzle in the beta-only namespace', () => {
    const puzzle = createPuzzle();
    const clone = cloneArchiveBetaDailyClueFrozenIssuedPuzzle(puzzle);

    expect(puzzle).toMatchObject({
      schemaVersion: 2,
      puzzleId: 'archive-beta-v1-daily-1',
      identity: { seriesVersion: 'archive-beta-v1', dailyNumber: 1 },
      issuedAt: '2026-09-29T07:00:00.000Z',
    });
    expect(clone).toEqual(puzzle);
    expect(clone).not.toBe(puzzle);
    expect(clone.identity).not.toBe(puzzle.identity);
    expect(clone.clueSnapshot).not.toBe(puzzle.clueSnapshot);
  });

  it('preserves first issue time on exact retry and rejects later immutable rewrites', async () => {
    const service = createArchiveBetaDailyClueFrozenIssuedPuzzleService(
      new InMemoryRepository(),
    );
    const base = {
      identity: identity(),
      canonicalPlayerIds: PLAYERS,
      clueSnapshot: clues(),
    };

    await expect(service.issue({
      ...base,
      issuedAt: '2026-09-29T07:00:00.000Z',
    })).resolves.toMatchObject({ ok: true, status: 'created' });

    await expect(service.issue({
      ...base,
      issuedAt: '2026-09-29T08:00:00.000Z',
    })).resolves.toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: '2026-09-29T07:00:00.000Z' },
    });

    await expect(service.issue({
      ...base,
      clueSnapshot: clues(PLAYERS, 'ZZ'),
      issuedAt: '2026-09-29T08:00:00.000Z',
    })).resolves.toMatchObject({ ok: false, error: 'immutable_conflict' });

    const reordered = [...PLAYERS];
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    await expect(service.issue({
      identity: identity(),
      canonicalPlayerIds: reordered,
      clueSnapshot: clues(reordered),
      issuedAt: '2026-09-29T08:00:00.000Z',
    })).resolves.toMatchObject({ ok: false, error: 'immutable_conflict' });
  });

  it('rejects permanent-v1 identity passed through an unsafe cast', () => {
    const wrong = {
      seriesVersion: 'permanent-v1',
      puzzleDate: '2026-09-29',
      dailyNumber: 1,
    } as unknown as ArchiveBetaDailyIdentity;

    expect(() => createPuzzle(wrong)).toThrow(
      'Unsupported archive beta Daily series version: permanent-v1.',
    );
  });
});

function identity(): ArchiveBetaDailyIdentity {
  const value = resolveArchiveBetaDailyIdentityForDate(
    '2026-09-29',
    createArchiveBetaDailyEpoch('2026-09-29'),
  );
  if (value === null) throw new Error('Expected archive beta identity.');
  return value;
}

function createPuzzle(value = identity()): ArchiveBetaDailyClueFrozenIssuedPuzzle {
  return createArchiveBetaDailyClueFrozenIssuedPuzzle({
    identity: value,
    canonicalPlayerIds: PLAYERS,
    clueSnapshot: clues(),
    issuedAt: '2026-09-29T03:00:00-04:00',
  });
}

function clues(players: readonly string[] = PLAYERS, firstInitials = 'P1') {
  return createPermanentDailyIssuedClueSnapshot({
    hintLayout: [
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ],
    pitches: players.map((canonicalPlayerId, index) => ({
      pitchNumber: index + 1,
      canonicalPlayerId,
      initials: index === 0 ? firstInitials : `P${index + 1}`,
      hintValues: ['2000s', 'SEA, CIN', index === 8 ? 'P' : 'CF', 'Career stats'],
    })),
  });
}

class InMemoryRepository implements ArchiveBetaDailyIssuedPuzzleRepository {
  private stored: ArchiveBetaDailyClueFrozenIssuedPuzzle | null = null;

  async insertIfAbsent(
    puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle,
  ): Promise<ArchiveBetaDailyIssuedPuzzleRepositoryInsertResult> {
    if (this.stored !== null) return { status: 'existing', puzzle: this.stored };
    this.stored = puzzle;
    return { status: 'inserted', puzzle };
  }
}
