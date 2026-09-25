import { describe, expect, it } from 'vitest';
import type { DailyEditorialSelection } from './dailyPuzzleLifecycle';
import { createPermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import {
  createPermanentDailyClueFrozenIssuanceService,
  createPermanentDailyIssuanceService,
  type PermanentDailyIssuanceEditorialPuzzle,
} from './permanentDailyIssuance';
import {
  type PermanentDailyIssuedPuzzleRecord,
  type PermanentDailyIssuedPuzzleRepository,
  type PermanentDailyIssuedPuzzleRepositoryInsertResult,
} from './permanentDailyIssuedPuzzle';
import {
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
} from './permanentDailyIdentity';

const PLAYER_IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

describe('Permanent Daily clue-frozen issuance orchestration', () => {
  it('freezes an eligible editorial lineup with the supplied public clue snapshot as schema v2', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyClueFrozenIssuanceService(repository);
    const identity = requireIdentity('2030-04-05');

    const result = await service.issue({
      identity,
      editorialPuzzle: createEditorialPuzzle(
        '2030-04-05',
        'scheduled',
        createSelections().reverse(),
      ),
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2030-04-05T07:00:00.000Z',
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      puzzle: {
        schemaVersion: 2,
        puzzleId: 'permanent-v1-daily-1',
        identity,
        canonicalPlayerIds: PLAYER_IDS,
        clueSnapshot: {
          pitches: [
            {
              pitchNumber: 1,
              canonicalPlayerId: 'player-1',
              initials: 'P1',
            },
          ],
        },
      },
    });
  });

  it('rejects clue/player order drift before persistence', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyClueFrozenIssuanceService(repository);
    const clueSnapshot = createClueSnapshot();
    const mismatched = {
      ...clueSnapshot,
      pitches: clueSnapshot.pitches.map((pitch, index) => (
        index === 3 ? { ...pitch, canonicalPlayerId: 'different-player' } : pitch
      )),
    };

    await expect(service.issue({
      identity: requireIdentity('2030-04-05'),
      editorialPuzzle: createEditorialPuzzle('2030-04-05', 'published'),
      clueSnapshot: mismatched,
      issuedAt: '2030-04-05T07:00:00.000Z',
    })).rejects.toThrow('does not match frozen batting order');

    expect(repository.insertCalls).toBe(0);
  });
});

describe('Permanent Daily issuance orchestration', () => {
  it('freezes a scheduled editorial lineup in exact slot order for an explicit permanent identity', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyIssuanceService(repository);
    const identity = requireIdentity('2030-04-05');

    const result = await service.issue({
      identity,
      editorialPuzzle: createEditorialPuzzle(
        '2030-04-05',
        'scheduled',
        createSelections().reverse(),
      ),
      issuedAt: '2030-04-05T07:00:00.000Z',
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      puzzle: {
        puzzleId: 'permanent-v1-daily-1',
        identity,
        canonicalPlayerIds: PLAYER_IDS,
      },
    });
  });

  it('accepts published editorial content and preserves existing idempotent issue semantics', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyIssuanceService(repository);
    const identity = requireIdentity('2030-04-05');
    const editorialPuzzle = createEditorialPuzzle('2030-04-05', 'published');

    await service.issue({
      identity,
      editorialPuzzle,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    const retry = await service.issue({
      identity,
      editorialPuzzle,
      issuedAt: '2030-04-05T08:00:00.000Z',
    });

    expect(retry).toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: '2030-04-05T07:00:00.000Z' },
    });
  });

  it('rejects draft and archived editorial records before persistence', async () => {
    for (const status of ['draft', 'archived'] as const) {
      const repository = new InMemoryIssuedPuzzleRepository();
      const service = createPermanentDailyIssuanceService(repository);

      await expect(service.issue({
        identity: requireIdentity('2030-04-05'),
        editorialPuzzle: createEditorialPuzzle('2030-04-05', status),
        issuedAt: '2030-04-05T07:00:00.000Z',
      })).rejects.toThrow('scheduled or published');

      expect(repository.insertCalls).toBe(0);
    }
  });

  it('rejects a permanent identity that does not match the editorial puzzle date', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyIssuanceService(repository);

    await expect(service.issue({
      identity: requireIdentity('2030-04-06'),
      editorialPuzzle: createEditorialPuzzle('2030-04-05', 'scheduled'),
      issuedAt: '2030-04-06T07:00:00.000Z',
    })).rejects.toThrow('does not match editorial puzzle');

    expect(repository.insertCalls).toBe(0);
  });

  it('rejects malformed editorial slot sets before freezing the lineup', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyIssuanceService(repository);
    const selections = createSelections();
    selections[1] = { ...selections[1]!, slot: 1 };

    await expect(service.issue({
      identity: requireIdentity('2030-04-05'),
      editorialPuzzle: createEditorialPuzzle('2030-04-05', 'scheduled', selections),
      issuedAt: '2030-04-05T07:00:00.000Z',
    })).rejects.toThrow('exact editorial slots 1 through 9');

    expect(repository.insertCalls).toBe(0);
  });
});

function createEditorialPuzzle(
  puzzleDate: string,
  status: PermanentDailyIssuanceEditorialPuzzle['status'],
  selections: readonly DailyEditorialSelection[] = createSelections(),
): PermanentDailyIssuanceEditorialPuzzle {
  return {
    puzzleDate,
    status,
    selections,
  };
}

function createSelections(): DailyEditorialSelection[] {
  return PLAYER_IDS.map((canonicalPlayerId, index) => ({
    slot: index + 1,
    canonicalPlayerId,
    source: 'generated',
  }));
}

function createClueSnapshot() {
  return createPermanentDailyIssuedClueSnapshot({
    hintLayout: [
      { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
      { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
      { slot: 3, hintType: 'position', displayLabel: 'Position' },
      { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
    ],
    pitches: PLAYER_IDS.map((canonicalPlayerId, index) => ({
      pitchNumber: index + 1,
      canonicalPlayerId,
      initials: `P${index + 1}`,
      hintValues: ['2000s', 'SEA, CIN', index === 8 ? 'P' : 'CF', 'Career stats'],
    })),
  });
}

function requireIdentity(puzzleDate: string) {
  const epoch = createPermanentDailyLaunchEpoch('2030-04-05');
  const identity = resolvePermanentDailyIdentityForDate(puzzleDate, epoch);
  if (identity === null) throw new Error('Expected permanent identity.');
  return identity;
}

class InMemoryIssuedPuzzleRepository implements PermanentDailyIssuedPuzzleRepository {
  private stored: PermanentDailyIssuedPuzzleRecord | null = null;
  insertCalls = 0;

  async insertIfAbsent(
    puzzle: PermanentDailyIssuedPuzzleRecord,
  ): Promise<PermanentDailyIssuedPuzzleRepositoryInsertResult> {
    this.insertCalls += 1;
    if (this.stored !== null) {
      return { status: 'existing', puzzle: this.stored };
    }
    this.stored = puzzle;
    return { status: 'inserted', puzzle };
  }
}
