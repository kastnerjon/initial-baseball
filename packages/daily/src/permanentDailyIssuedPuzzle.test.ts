import { describe, expect, it } from 'vitest';
import {
  PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyIssuedPuzzleService,
  createPermanentDailyPuzzleId,
  type PermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRepository,
} from './permanentDailyIssuedPuzzle';
import {
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
} from './permanentDailyIdentity';

const PLAYER_IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

describe('Permanent Daily issued puzzle', () => {
  it('creates one frozen snapshot from a permanent identity and exact batting order', () => {
    const identity = requireIdentity('2030-04-05');

    expect(createPermanentDailyIssuedPuzzle({
      identity,
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    })).toEqual({
      schemaVersion: PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
      puzzleId: 'permanent-v1-daily-1',
      identity,
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    expect(createPermanentDailyPuzzleId(identity)).toBe('permanent-v1-daily-1');
  });

  it('rejects missing, duplicate, or non-nine-player snapshots', () => {
    const identity = requireIdentity('2030-04-05');
    const create = (canonicalPlayerIds: readonly string[]) => createPermanentDailyIssuedPuzzle({
      identity,
      canonicalPlayerIds,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });

    expect(() => create(PLAYER_IDS.slice(0, 8))).toThrow('exactly 9 players');
    expect(() => create([...PLAYER_IDS.slice(0, 8), PLAYER_IDS[0]!])).toThrow(
      'Duplicate permanent Daily canonical player',
    );
    expect(() => create([...PLAYER_IDS.slice(0, 8), '   '])).toThrow(
      'Permanent Daily canonical player ID is required.',
    );
  });

  it('treats an exact re-issue as idempotent while preserving the first issue timestamp', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyIssuedPuzzleService(repository);
    const identity = requireIdentity('2030-04-05');

    const created = await service.issue({
      identity,
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    const existing = await service.issue({
      identity,
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T08:00:00.000Z',
    });

    expect(created.ok && created.status).toBe('created');
    expect(existing).toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: '2030-04-05T07:00:00.000Z' },
    });
  });

  it('rejects any later attempt to rewrite the issued batting order', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyIssuedPuzzleService(repository);
    const identity = requireIdentity('2030-04-05');

    await service.issue({
      identity,
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    const rewritten = [...PLAYER_IDS];
    [rewritten[0], rewritten[1]] = [rewritten[1]!, rewritten[0]!];

    const result = await service.issue({
      identity,
      canonicalPlayerIds: rewritten,
      issuedAt: '2030-04-05T08:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected immutable conflict.');
    expect(result.error).toBe('immutable_conflict');
    expect(result.existing.canonicalPlayerIds).toEqual(PLAYER_IDS);
    expect(result.requested.canonicalPlayerIds).toEqual(rewritten);
  });

  it('rejects invalid permanent identity or issue timestamps at the boundary', () => {
    const identity = requireIdentity('2030-04-05');

    expect(() => createPermanentDailyIssuedPuzzle({
      identity: { ...identity, dailyNumber: 0 },
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    })).toThrow('positive safe integer');

    expect(() => createPermanentDailyIssuedPuzzle({
      identity,
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: 'not-a-timestamp',
    })).toThrow('Invalid permanent Daily issued timestamp');
  });
});

function requireIdentity(puzzleDate: string) {
  const epoch = createPermanentDailyLaunchEpoch('2030-04-05');
  const identity = resolvePermanentDailyIdentityForDate(puzzleDate, epoch);
  if (identity === null) throw new Error('Expected permanent identity.');
  return identity;
}

class InMemoryIssuedPuzzleRepository implements PermanentDailyIssuedPuzzleRepository {
  private stored: PermanentDailyIssuedPuzzle | null = null;

  async insertIfAbsent(
    puzzle: PermanentDailyIssuedPuzzle,
  ): Promise<
    | { status: 'inserted'; puzzle: PermanentDailyIssuedPuzzle }
    | { status: 'existing'; puzzle: PermanentDailyIssuedPuzzle }
  > {
    if (this.stored !== null) {
      return { status: 'existing', puzzle: this.stored };
    }
    this.stored = puzzle;
    return { status: 'inserted', puzzle };
  }
}
