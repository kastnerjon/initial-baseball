import {
  createDailyPuzzleDraft,
  createPermanentDailyLaunchEpoch,
  getDailyPuzzleNumber,
  resolvePermanentDailyIdentityForDate,
  scheduleDailyPuzzle,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type PermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ServerPermanentDailyIssuanceError,
  createServerPermanentDailyIssuanceService,
} from './serverPermanentDailyIssuance';

const PUZZLE_DATE = '2030-04-05';
const ISSUED_AT = '2030-04-05T07:00:00.000Z';
const ENVIRONMENT = {
  SUPABASE_URL: 'https://initial-baseball.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-service-role-key',
};

describe('server permanent Daily issuance composition', () => {
  it('uses one server Supabase client for the authoritative editorial read and immutable issue write', async () => {
    const client = {} as SupabaseClient;
    const editorialPuzzle = buildScheduledEditorialPuzzle();
    const editorialRepository = createEditorialRepository(editorialPuzzle);
    const issuedRepository = new InMemoryIssuedPuzzleRepository();

    const createSupabaseClient = vi.fn(
      (_environment: Record<string, string | undefined>): SupabaseClient => client,
    );
    const createEditorialRepository = vi.fn(
      (_client: SupabaseClient): DailyPuzzleRepository => editorialRepository,
    );
    const createIssuedPuzzleRepository = vi.fn(
      (_client: SupabaseClient): PermanentDailyIssuedPuzzleRepository => issuedRepository,
    );

    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        createSupabaseClient,
        createEditorialRepository,
        createIssuedPuzzleRepository,
      },
    });

    const identity = requireIdentity(PUZZLE_DATE);
    const result = await service.issue({ identity, issuedAt: ISSUED_AT });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      puzzle: {
        puzzleId: 'permanent-v1-daily-1',
        identity,
        canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `player-${index + 1}`),
      },
    });
    expect(createSupabaseClient).toHaveBeenCalledWith(ENVIRONMENT);
    expect(createEditorialRepository).toHaveBeenCalledWith(client);
    expect(createIssuedPuzzleRepository).toHaveBeenCalledWith(client);
    expect(editorialRepository.getByDate).toHaveBeenCalledWith(PUZZLE_DATE);
  });

  it('fails closed before persistence when the authoritative editorial row is missing', async () => {
    const issuedRepository = new InMemoryIssuedPuzzleRepository();
    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: createDependencies(
        createEditorialRepository(null),
        issuedRepository,
      ),
    });

    await expect(service.issue({
      identity: requireIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    })).rejects.toMatchObject({
      kind: 'missing-editorial-puzzle',
      message: expect.stringContaining(PUZZLE_DATE),
    } satisfies Partial<ServerPermanentDailyIssuanceError>);

    expect(issuedRepository.insertCalls).toBe(0);
  });

  it('leaves editorial lifecycle eligibility to the portable issuance service', async () => {
    const issuedRepository = new InMemoryIssuedPuzzleRepository();
    const draft = createDailyPuzzleDraft({
      id: 'beta-editorial-record',
      puzzleDate: PUZZLE_DATE,
      puzzleNumber: getDailyPuzzleNumber(PUZZLE_DATE),
      selections: buildSelections(),
      actorId: 'editor-1',
      occurredAt: '2030-04-04T12:00:00.000Z',
    });
    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: createDependencies(
        createEditorialRepository(draft),
        issuedRepository,
      ),
    });

    await expect(service.issue({
      identity: requireIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    })).rejects.toThrow('scheduled or published');

    expect(issuedRepository.insertCalls).toBe(0);
  });
});

function createDependencies(
  editorialRepository: DailyPuzzleRepository,
  issuedRepository: PermanentDailyIssuedPuzzleRepository,
) {
  const client = {} as SupabaseClient;
  return {
    createSupabaseClient: vi.fn(
      (_environment: Record<string, string | undefined>): SupabaseClient => client,
    ),
    createEditorialRepository: vi.fn(
      (_client: SupabaseClient): DailyPuzzleRepository => editorialRepository,
    ),
    createIssuedPuzzleRepository: vi.fn(
      (_client: SupabaseClient): PermanentDailyIssuedPuzzleRepository => issuedRepository,
    ),
  };
}

function createEditorialRepository(
  record: DailyPuzzleEditorialRecord | null,
): DailyPuzzleRepository & { getByDate: ReturnType<typeof vi.fn> } {
  const getByDate = vi.fn().mockResolvedValue(record);
  return {
    getByDate,
    listByDateRange: vi.fn(),
    save: vi.fn(),
  };
}

function buildScheduledEditorialPuzzle(): DailyPuzzleEditorialRecord {
  return scheduleDailyPuzzle(createDailyPuzzleDraft({
    id: 'beta-editorial-record',
    puzzleDate: PUZZLE_DATE,
    puzzleNumber: getDailyPuzzleNumber(PUZZLE_DATE),
    selections: buildSelections().reverse(),
    actorId: 'editor-1',
    occurredAt: '2030-04-04T12:00:00.000Z',
  }), {
    actorId: 'editor-1',
    occurredAt: '2030-04-04T13:00:00.000Z',
  });
}

function buildSelections() {
  return Array.from({ length: 9 }, (_, index) => ({
    slot: index + 1,
    canonicalPlayerId: `player-${index + 1}`,
    source: 'generated' as const,
  }));
}

function requireIdentity(puzzleDate: string) {
  const identity = resolvePermanentDailyIdentityForDate(
    puzzleDate,
    createPermanentDailyLaunchEpoch(PUZZLE_DATE),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');
  return identity;
}

class InMemoryIssuedPuzzleRepository implements PermanentDailyIssuedPuzzleRepository {
  private stored: PermanentDailyIssuedPuzzle | null = null;
  insertCalls = 0;

  async insertIfAbsent(puzzle: PermanentDailyIssuedPuzzle) {
    this.insertCalls += 1;
    if (this.stored !== null) {
      return { status: 'existing' as const, puzzle: this.stored };
    }
    this.stored = puzzle;
    return { status: 'inserted' as const, puzzle };
  }
}
