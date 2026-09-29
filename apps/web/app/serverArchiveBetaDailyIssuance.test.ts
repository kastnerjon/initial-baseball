import {
  createArchiveBetaDailyEpoch,
  createDailyPuzzleDraft,
  getDailyPuzzleNumber,
  resolveArchiveBetaDailyIdentityForDate,
  scheduleDailyPuzzle,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type ArchiveBetaDailyIssuedPuzzleRepository,
  type DailyPuzzleEditorialRecord,
  type DailyPuzzleRepository,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ServerArchiveBetaDailyIssuanceError,
  createServerArchiveBetaDailyIssuanceService,
} from './serverArchiveBetaDailyIssuance';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';

const PUZZLE_DATE = '2026-09-29';
const ISSUED_AT = '2026-09-29T07:00:00.000Z';
const ENVIRONMENT = {
  SUPABASE_URL: 'https://initial-baseball.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-service-role-key',
};

describe('server archive beta Daily issuance composition', () => {
  it('reuses one server client and freezes authoritative editorial content as beta schema v2', async () => {
    const client = {} as SupabaseClient;
    const editorialRepository = editorialRepositoryFor(scheduledEditorial());
    const issuedRepository = new InMemoryArchiveBetaRepository();
    const createSupabaseClient = vi.fn(() => client);
    const createEditorialRepository = vi.fn(() => editorialRepository);
    const createIssuedPuzzleRepository = vi.fn(() => issuedRepository);

    const service = createServerArchiveBetaDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        createSupabaseClient,
        createEditorialRepository,
        createIssuedPuzzleRepository,
        resolveCanonicalPlayer: buildPlayer,
        createDailyPitch: createDailyPuzzlePitch,
      },
    });

    const result = await service.issue({
      identity: betaIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'created',
      puzzle: {
        schemaVersion: 2,
        puzzleId: 'archive-beta-v1-daily-1',
        canonicalPlayerIds: playerIds(),
        issuedAt: ISSUED_AT,
      },
    });
    if (!result.ok) throw new Error('Expected archive beta puzzle creation.');
    expect(result.puzzle.clueSnapshot.pitches[0]).toMatchObject({
      pitchNumber: 1,
      canonicalPlayerId: 'player-1',
      hintValues: [
        '2000s',
        'NYY, BOS',
        'CF',
        'HR 200 / RBI 800 / SB 100 / BA .280 / OBP .350',
      ],
    });
    expect(createSupabaseClient).toHaveBeenCalledWith(ENVIRONMENT);
    expect(createEditorialRepository).toHaveBeenCalledWith(client);
    expect(createIssuedPuzzleRepository).toHaveBeenCalledWith(client);
    expect(editorialRepository.getByDate).toHaveBeenCalledWith(PUZZLE_DATE);
  });

  it('preserves the first issue timestamp on an exact composition retry', async () => {
    const issuedRepository = new InMemoryArchiveBetaRepository();
    const service = createServerArchiveBetaDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: dependencies(
        editorialRepositoryFor(scheduledEditorial()),
        issuedRepository,
      ),
    });
    const identity = betaIdentity(PUZZLE_DATE);

    await service.issue({ identity, issuedAt: ISSUED_AT });
    const retry = await service.issue({
      identity,
      issuedAt: '2026-09-29T08:00:00.000Z',
    });

    expect(retry).toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: ISSUED_AT },
    });
  });

  it('fails closed before persistence when editorial content is absent or ineligible', async () => {
    for (const editorialPuzzle of [null, draftEditorial()] as const) {
      const issuedRepository = new InMemoryArchiveBetaRepository();
      const service = createServerArchiveBetaDailyIssuanceService({
        environment: ENVIRONMENT,
        dependencies: dependencies(
          editorialRepositoryFor(editorialPuzzle),
          issuedRepository,
        ),
      });

      const attempt = service.issue({
        identity: betaIdentity(PUZZLE_DATE),
        issuedAt: ISSUED_AT,
      });

      if (editorialPuzzle === null) {
        await expect(attempt).rejects.toMatchObject({
          kind: 'missing-editorial-puzzle',
        } satisfies Partial<ServerArchiveBetaDailyIssuanceError>);
      } else {
        await expect(attempt).rejects.toThrow('scheduled or published');
      }
      expect(issuedRepository.insertCalls).toBe(0);
    }
  });

  it('fails before persistence when a canonical player cannot be materialized', async () => {
    const issuedRepository = new InMemoryArchiveBetaRepository();
    const base = dependencies(
      editorialRepositoryFor(scheduledEditorial()),
      issuedRepository,
    );
    const service = createServerArchiveBetaDailyIssuanceService({
      environment: ENVIRONMENT,
      dependencies: {
        ...base,
        resolveCanonicalPlayer: canonicalPlayerId => (
          canonicalPlayerId === 'player-5' ? null : buildPlayer(canonicalPlayerId)
        ),
      },
    });

    await expect(service.issue({
      identity: betaIdentity(PUZZLE_DATE),
      issuedAt: ISSUED_AT,
    })).rejects.toThrow(
      'Archive beta Daily clue issuance cannot resolve gameplay-ready canonical player player-5',
    );
    expect(issuedRepository.insertCalls).toBe(0);
  });
});

function dependencies(
  editorialRepository: DailyPuzzleRepository,
  issuedRepository: ArchiveBetaDailyIssuedPuzzleRepository,
) {
  const client = {} as SupabaseClient;
  return {
    createSupabaseClient: vi.fn(() => client),
    createEditorialRepository: vi.fn(() => editorialRepository),
    createIssuedPuzzleRepository: vi.fn(() => issuedRepository),
    resolveCanonicalPlayer: vi.fn(buildPlayer),
    createDailyPitch: createDailyPuzzlePitch,
  };
}

function editorialRepositoryFor(
  record: DailyPuzzleEditorialRecord | null,
): DailyPuzzleRepository & { getByDate: ReturnType<typeof vi.fn> } {
  const getByDate = vi.fn().mockResolvedValue(record);
  return {
    getByDate,
    listByDateRange: vi.fn(),
    save: vi.fn(),
  };
}

function scheduledEditorial(): DailyPuzzleEditorialRecord {
  return scheduleDailyPuzzle(draftEditorial(), {
    actorId: 'editor-1',
    occurredAt: '2026-09-28T13:00:00.000Z',
  });
}

function draftEditorial(): DailyPuzzleEditorialRecord {
  return createDailyPuzzleDraft({
    id: 'archive-beta-editorial-record',
    puzzleDate: PUZZLE_DATE,
    puzzleNumber: getDailyPuzzleNumber(PUZZLE_DATE),
    selections: playerIds().map((canonicalPlayerId, index) => ({
      slot: index + 1,
      canonicalPlayerId,
      source: 'generated' as const,
    })).reverse(),
    actorId: 'editor-1',
    occurredAt: '2026-09-28T12:00:00.000Z',
  });
}

function betaIdentity(puzzleDate: string) {
  const identity = resolveArchiveBetaDailyIdentityForDate(
    puzzleDate,
    createArchiveBetaDailyEpoch(PUZZLE_DATE),
  );
  if (identity === null) throw new Error('Expected archive beta identity.');
  return identity;
}

function playerIds() {
  return Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
}

function buildPlayer(canonicalPlayerId: string): Player {
  const index = Number(canonicalPlayerId.replace('player-', ''));
  return {
    id: `legacy-${canonicalPlayerId}`,
    fullName: `Player ${index}`,
    displayName: `Player ${index}`,
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'NYY',
    teamsDisplay: 'NYY, BOS',
    statsLine: 'not used',
    careerStats: {
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

class InMemoryArchiveBetaRepository implements ArchiveBetaDailyIssuedPuzzleRepository {
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
