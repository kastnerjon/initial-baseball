import {
  createPermanentDailyIssuedPuzzle,
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
  type PermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleReadRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createServerPermanentDailyIssuedPuzzleReadService,
} from './serverPermanentDailyIssuedPuzzleRead';

const ENVIRONMENT = {
  SUPABASE_URL: 'https://initial-baseball.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-service-role-key',
};
const PUZZLE = createPuzzle();

describe('server permanent Daily issued-puzzle read composition', () => {
  it('uses one server Supabase client and the portable service for number reads', async () => {
    const client = {} as SupabaseClient;
    const repository = createReadRepository({ byNumber: PUZZLE });
    const createSupabaseClient = vi.fn(
      (_environment: Record<string, string | undefined>): SupabaseClient => client,
    );
    const createReadRepositoryFactory = vi.fn(
      (_client: SupabaseClient): PermanentDailyIssuedPuzzleReadRepository => repository,
    );

    const service = createServerPermanentDailyIssuedPuzzleReadService({
      environment: ENVIRONMENT,
      dependencies: {
        createSupabaseClient,
        createReadRepository: createReadRepositoryFactory,
      },
    });
    const result = await service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    });

    expect(result).toEqual(PUZZLE);
    expect(createSupabaseClient).toHaveBeenCalledWith(ENVIRONMENT);
    expect(createReadRepositoryFactory).toHaveBeenCalledWith(client);
    expect(repository.getByNumber).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      dailyNumber: 1,
    });
    expect(repository.getByDate).not.toHaveBeenCalled();
  });

  it('preserves nullable date reads without deriving a launch epoch', async () => {
    const repository = createReadRepository({});
    const service = createServerPermanentDailyIssuedPuzzleReadService({
      environment: ENVIRONMENT,
      dependencies: createDependencies(repository),
    });

    await expect(service.getByDate({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-06',
    })).resolves.toBeNull();

    expect(repository.getByDate).toHaveBeenCalledWith({
      seriesVersion: 'permanent-v1',
      puzzleDate: '2030-04-06',
    });
  });

  it('retains portable query validation before provider access', async () => {
    const repository = createReadRepository({});
    const service = createServerPermanentDailyIssuedPuzzleReadService({
      environment: ENVIRONMENT,
      dependencies: createDependencies(repository),
    });

    await expect(service.getByNumber({
      seriesVersion: 'permanent-v1',
      dailyNumber: 0,
    })).rejects.toThrow('positive safe integer');

    expect(repository.getByNumber).not.toHaveBeenCalled();
    expect(repository.getByDate).not.toHaveBeenCalled();
  });
});

function createDependencies(
  repository: PermanentDailyIssuedPuzzleReadRepository,
) {
  const client = {} as SupabaseClient;
  return {
    createSupabaseClient: vi.fn(
      (_environment: Record<string, string | undefined>): SupabaseClient => client,
    ),
    createReadRepository: vi.fn(
      (_client: SupabaseClient): PermanentDailyIssuedPuzzleReadRepository => repository,
    ),
  };
}

function createReadRepository({
  byNumber = null,
  byDate = null,
}: {
  byNumber?: PermanentDailyIssuedPuzzle | null;
  byDate?: PermanentDailyIssuedPuzzle | null;
}): PermanentDailyIssuedPuzzleReadRepository & {
  getByNumber: ReturnType<typeof vi.fn>;
  getByDate: ReturnType<typeof vi.fn>;
} {
  return {
    getByNumber: vi.fn().mockResolvedValue(byNumber),
    getByDate: vi.fn().mockResolvedValue(byDate),
  };
}

function createPuzzle(): PermanentDailyIssuedPuzzle {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');

  return createPermanentDailyIssuedPuzzle({
    identity,
    canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `player-${index + 1}`),
    issuedAt: '2030-04-05T07:00:00.000Z',
  });
}
