import {
  createDailyPuzzleDraft,
  createPermanentDailyLaunchEpoch,
  getDailyPuzzleNumber,
  resolvePermanentDailyIdentityForDate,
  scheduleDailyPuzzle,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
  type PermanentDailyIssuedPuzzleRecord,
  type PermanentDailyIssuedPuzzleRepository,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ServerPermanentDailyIssuanceError,
  createServerPermanentDailyIssuanceService,
} from './serverPermanentDailyIssuance';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import type { DailyPitchFactory } from './materializePermanentDailyIssuedClueSnapshot';

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
    const createEditorialRepositoryFactory = vi.fn(
      (_client: SupabaseClient): DailyPuzzleRepository => editorialRepository,
    );
    const createIssuedPuzzleRepositoryFactory = vi.fn(
      (_client: SupabaseClient): PermanentDailyIssuedPuzzleRepository => issuedRepository,
    );

    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        createSupabaseClient,
        createEditorialRepository: createEditorialRepositoryFactory,
        createIssuedPuzzleRepository: createIssuedPuzzleRepositoryFactory,
        resolveCanonicalPlayer: vi.fn(buildPlayerForCanonicalId),
        createDailyPitch: createDailyPuzzlePitch,
      },
    });

    const identity = requireIdentity(PUZZLE_DATE);
    const result = await service.issue({ identity, issuedAt: ISSUED_AT });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      puzzle: {
        schemaVersion: 2,
        puzzleId: 'permanent-v1-daily-1',
        identity,
        canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `player-${index + 1}`),
        clueSnapshot: {
          hintLayout: [
            { slot: 1, hintType: 'main_decade', displayLabel: 'Main decade played in' },
            { slot: 2, hintType: 'teams', displayLabel: 'Teams' },
            { slot: 3, hintType: 'position', displayLabel: 'Position' },
            { slot: 4, hintType: 'stats', displayLabel: 'Stats' },
          ],
        },
      },
    });
    if (!result.ok) throw new Error('Expected the schema-v2 puzzle to be created.');
    expect(result.puzzle.clueSnapshot.pitches.map(pitch => pitch.canonicalPlayerId))
      .toEqual(Array.from({ length: 9 }, (_, index) => `player-${index + 1}`));
    expect(result.puzzle.clueSnapshot.pitches.map(pitch => pitch.pitchNumber))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.puzzle.clueSnapshot.pitches.every(pitch => pitch.hintValues.length === 4))
      .toBe(true);
    expect(result.puzzle.clueSnapshot.pitches.map(pitch => pitch.initials))
      .toEqual(['AL', 'BR', 'CY', 'DD', 'EM', 'FT', 'GM', 'HA', 'IR']);
    expect(result.puzzle.clueSnapshot.pitches[0]?.hintValues).toEqual([
      '2000s',
      'NYY, BOS',
      'CF',
      'HR 200 / RBI 800 / SB 100 / BA .280 / OBP .350',
    ]);
    expect(result.puzzle.clueSnapshot.pitches[7]?.hintValues[3]).toBe(
      'W 10 / L 5 / SV 0 / ERA 2.10 / WHIP 1.01 / K 20',
    );
    expect(result.puzzle.clueSnapshot.pitches[8]?.hintValues[3]).toBe(
      'W 10 / L 5 / ERA 2.10 / WHIP 1.01 / K 20',
    );
    expect(createSupabaseClient).toHaveBeenCalledWith(ENVIRONMENT);
    expect(createEditorialRepositoryFactory).toHaveBeenCalledWith(client);
    expect(createIssuedPuzzleRepositoryFactory).toHaveBeenCalledWith(client);
    expect(editorialRepository.getByDate).toHaveBeenCalledWith(PUZZLE_DATE);
  });

  it('preserves the first issue timestamp on an exact server-composition retry', async () => {
    const issuedRepository = new InMemoryIssuedPuzzleRepository();
    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: createDependencies(createEditorialRepository(buildScheduledEditorialPuzzle()), issuedRepository),
    });
    const identity = requireIdentity(PUZZLE_DATE);

    const first = await service.issue({ identity, issuedAt: ISSUED_AT });
    const retry = await service.issue({ identity, issuedAt: '2030-04-06T07:00:00.000Z' });

    expect(first).toMatchObject({ ok: true, status: 'created' });
    expect(retry).toMatchObject({ ok: true, status: 'existing' });
    expect(retry.ok && retry.puzzle.issuedAt).toBe(ISSUED_AT);
    expect(issuedRepository.insertCalls).toBe(2);
    expect(issuedRepository.storedPuzzle?.schemaVersion).toBe(2);
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

  it('fails closed before persistence when an editorial canonical player is unavailable', async () => {
    const issuedRepository = new InMemoryIssuedPuzzleRepository();
    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        ...createDependencies(createEditorialRepository(buildScheduledEditorialPuzzle()), issuedRepository),
        resolveCanonicalPlayer: canonicalPlayerId => (
          canonicalPlayerId === 'player-5' ? null : buildPlayerForCanonicalId(canonicalPlayerId)
        ),
      },
    });

    await expect(service.issue({
      identity: requireIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    })).rejects.toThrow('cannot resolve gameplay-ready canonical player player-5');
    expect(issuedRepository.insertCalls).toBe(0);
  });

  it('fails closed before persistence when a configured public hint is malformed', async () => {
    const issuedRepository = new InMemoryIssuedPuzzleRepository();
    const createDailyPitch: DailyPitchFactory = (pitchNumber, player) => {
      const pitch = createDailyPuzzlePitch(pitchNumber, player);
      return pitchNumber === 1
        ? { ...pitch, hints: { ...pitch.hints, teams: '' } }
        : pitch;
    };
    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        ...createDependencies(createEditorialRepository(buildScheduledEditorialPuzzle()), issuedRepository),
        createDailyPitch,
      },
    });

    await expect(service.issue({
      identity: requireIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    })).rejects.toThrow('no public teams hint for pitch 1 (player-1)');
    expect(issuedRepository.insertCalls).toBe(0);
  });

  it('fails closed before persistence when a configured public hint is missing', async () => {
    const issuedRepository = new InMemoryIssuedPuzzleRepository();
    const createDailyPitch: DailyPitchFactory = (pitchNumber, player) => {
      const pitch = createDailyPuzzlePitch(pitchNumber, player);
      if (pitchNumber !== 1) return pitch;
      return {
        ...pitch,
        hints: {
          main_decade: pitch.hints.main_decade ?? '2000s',
          position: pitch.hints.position ?? 'CF',
          stats: pitch.hints.stats ?? 'Stats',
        },
      };
    };
    const service = createServerPermanentDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        ...createDependencies(createEditorialRepository(buildScheduledEditorialPuzzle()), issuedRepository),
        createDailyPitch,
      },
    });

    await expect(service.issue({
      identity: requireIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    })).rejects.toThrow('no public teams hint for pitch 1 (player-1)');
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
  const players = new Map(
    Array.from({ length: 9 }, (_, index) => {
      const id = `player-${index + 1}`;
      return [id, buildPlayerForCanonicalId(id)] as const;
    }),
  );
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
    resolveCanonicalPlayer: vi.fn(
      (canonicalPlayerId: string): Player | null => players.get(canonicalPlayerId) ?? null,
    ),
    createDailyPitch: createDailyPuzzlePitch,
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
  storedPuzzle: PermanentDailyIssuedPuzzleRecord | null = null;
  insertCalls = 0;

  async insertIfAbsent(puzzle: PermanentDailyIssuedPuzzleRecord) {
    this.insertCalls += 1;
    if (this.storedPuzzle !== null) {
      return { status: 'existing' as const, puzzle: this.storedPuzzle };
    }
    this.storedPuzzle = puzzle;
    return { status: 'inserted' as const, puzzle };
  }
}

function buildPlayerForCanonicalId(canonicalPlayerId: string): Player {
  const index = Number(canonicalPlayerId.replace('player-', ''));
  const names = [
    'Ada Lovelace',
    'Babe Ruth',
    'Cy Young',
    'Dizzy Dean',
    'Eddie Murray',
    'Frank Thomas',
    'Greg Maddux',
    'Hank Aaron',
    'Ivan Rodriguez',
  ];
  const fullName = names[index - 1];
  if (fullName === undefined) throw new Error(`No player fixture for ${canonicalPlayerId}.`);
  const isPitcher = index === 8 || index === 9;

  return {
    id: `legacy-${canonicalPlayerId}`,
    fullName,
    displayName: fullName,
    primaryRole: isPitcher ? 'pitcher' : 'hitter',
    primaryPosition: isPitcher ? 'P' : 'CF',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'NYY',
    teamsDisplay: 'NYY, BOS',
    statsLine: 'not used by structured hint 4',
    careerStats: isPitcher
      ? {
          kind: 'pitcher',
          stats: {
            W: 10,
            L: 5,
            ...(index === 8 ? { SV: 0 } : {}),
            ERA: '2.10',
            WHIP: '1.01',
            K: 20,
            IP: '100.0',
          },
        }
      : {
          kind: 'hitter',
          stats: {
            AB: 5000,
            R: 800,
            H: 1400,
            HR: 200,
            RBI: 800,
            SB: 100,
            BA: '.280',
            OBP: '.350',
            SLG: '.450',
            OPS: '.800',
          },
        },
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}
