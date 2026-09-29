import { describe, expect, it } from 'vitest';
import {
  createArchiveBetaDailyEpoch,
  resolveArchiveBetaDailyIdentityForDate,
  type ArchiveBetaDailyIdentity,
} from './archiveBetaDailyIdentity';
import {
  ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  cloneArchiveBetaDailyClueFrozenIssuedPuzzle,
  createArchiveBetaDailyClueFrozenIssuedPuzzle,
  createArchiveBetaDailyClueFrozenIssuedPuzzleService,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type ArchiveBetaDailyIssuedPuzzleRepository,
  type ArchiveBetaDailyIssuedPuzzleRepositoryInsertResult,
} from './archiveBetaDailyIssuedPuzzle';
import {
  createPermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';

const PLAYER_IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

describe('Archive beta clue-frozen issued puzzle', () => {
  it('creates a schema-v2 puzzle in the beta-only identity namespace', () => {
    const puzzle = createArchiveBetaDailyClueFrozenIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2026-09-29T03:00:00-04:00',
    });

    expect(puzzle).toMatchObject({
      schemaVersion: ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
      puzzleId: 'archive-beta-v1-daily-1',
      identity: {
        seriesVersion: 'archive-beta-v1',
        puzzleDate: '2026-09-29',
        dailyNumber: 1,
      },
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2026-09-29T07:00:00.000Z',
    });
  });

  it('preserves the first issue timestamp on an exact retry', async () => {
    const repository = new InMemoryArchiveBetaRepository();
    const service = createArchiveBetaDailyClueFrozenIssuedPuzzleService(repository);
    const input = {
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
    };

    const created = await service.issue({
      ...input,
      issuedAt: '2026-09-29T07:00:00.000Z',
    });
    const existing = await service.issue({
      ...input,
      issuedAt: '2026-09-29T08:00:00.000Z',
    });

    expect(created).toMatchObject({ ok: true, status: 'created' });
    expect(existing).toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: '2026-09-29T07:00:00.000Z' },
    });
  });

  it('rejects any later lineup or clue rewrite as an immutable conflict', async () => {
    const repository = new InMemoryArchiveBetaRepository();
    const service = createArchiveBetaDailyClueFrozenIssuedPuzzleService(repository);

    await service.issue({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2026-09-29T07:00:00.000Z',
    });

    const changedClues = createClueSnapshot();
    changedClues.pitches[0] = {
      ...changedClues.pitches[0]!,
      initials: 'ZZ',
    };

    const clueConflict = await service.issue({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: changedClues,
      issuedAt: '2026-09-29T08:00:00.000Z',
    });
    expect(clueConflict.ok).toBe(false);

    const changedPlayers = [...PLAYER_IDS];
    [changedPlayers[0], changedPlayers[1]] = [changedPlayers[1]!, changedPlayers[0]!];
    const lineupConflict = await service.issue({
      identity: requireIdentity(),
      canonicalPlayerIds: changedPlayers,
      clueSnapshot: createClueSnapshot(changedPlayers),
      issuedAt: '2026-09-29T08:00:00.000Z',
    });
    expect(lineupConflict.ok).toBe(false);
  });

  it('keeps the beta facade fenced from permanent-v1 identities at runtime', () => {
    const permanentIdentity = {
      seriesVersion: 'permanent-v1',
      puzzleDate: '2026-09-29',
      dailyNumber: 1,
    } as unknown as ArchiveBetaDailyIdentity;

    expect(() => createArchiveBetaDailyClueFrozenIssuedPuzzle({
      identity: permanentIdentity,
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2026-09-29T07:00:00.000Z',
    })).toThrow('Unsupported archive beta Daily series version: permanent-v1.');
  });

  it('returns a defensive nested copy', () => {
    const puzzle = createArchiveBetaDailyClueFrozenIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2026-09-29T07:00:00.000Z',
    });

    const cloned = cloneArchiveBetaDailyClueFrozenIssuedPuzzle(puzzle);

    expect(cloned).toEqual(puzzle);
    expect(cloned).not.toBe(puzzle);
    expect(cloned.identity).not.toBe(puzzle.identity);
    expect(cloned.canonicalPlayerIds).not.toBe(puzzle.canonicalPlayerIds);
    expect(cloned.clueSnapshot).not.toBe(puzzle.clueSnapshot);
    expect(cloned.clueSnapshot.pitches[0]?.hintValues)
      .not.toBe(puzzle.clueSnapshot.pitches[0]?.hintValues);
  });
});

function requireIdentity() {
  const identity = resolveArchiveBetaDailyIdentityForDate(
    '2026-09-29',
    createArchiveBetaDailyEpoch('2026-09-29'),
  );
  if (identity === null) throw new Error('Expected archive beta identity.');
  return identity;
}

function createClueSnapshot(
  canonicalPlayerIds: readonly string[] = PLAYER_IDS,
): PermanentDailyIssuedClueSnapshot {
  return createPermanentDailyIssuedClueSnapshot({
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
  });
}

class InMemoryArchiveBetaRepository implements ArchiveBetaDailyIssuedPuzzleRepository {
  private stored: ArchiveBetaDailyClueFrozenIssuedPuzzle | null = null;

  async insertIfAbsent(
    puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle,
  ): Promise<ArchiveBetaDailyIssuedPuzzleRepositoryInsertResult> {
    if (this.stored !== null) {
      return { status: 'existing', puzzle: this.stored };
    }
    this.stored = puzzle;
    return { status: 'inserted', puzzle };
  }
}
