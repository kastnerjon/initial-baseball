import { describe, expect, it } from 'vitest';
import {
  createPermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';
import {
  PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  clonePermanentDailyIssuedPuzzleRecord,
  createPermanentDailyClueFrozenIssuedPuzzle,
  createPermanentDailyClueFrozenIssuedPuzzleService,
  createPermanentDailyIssuedPuzzle,
  type PermanentDailyIssuedPuzzleRecord,
  type PermanentDailyIssuedPuzzleRepository,
  type PermanentDailyIssuedPuzzleRepositoryInsertResult,
} from './permanentDailyIssuedPuzzle';
import {
  createPermanentDailyLaunchEpoch,
  resolvePermanentDailyIdentityForDate,
} from './permanentDailyIdentity';

const PLAYER_IDS = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);

describe('Permanent Daily clue-frozen issued puzzle envelope', () => {
  it('creates schema v2 by attaching a validated clue snapshot to the frozen batting order', () => {
    const puzzle = createPermanentDailyClueFrozenIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2030-04-05T03:00:00-04:00',
    });

    expect(puzzle).toMatchObject({
      schemaVersion: PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
      puzzleId: 'permanent-v1-daily-1',
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    expect(puzzle.clueSnapshot.pitches.map((pitch) => pitch.canonicalPlayerId))
      .toEqual(PLAYER_IDS);
    expect(puzzle.clueSnapshot).not.toHaveProperty('rulesetVersion');
  });

  it('rejects clue snapshots whose canonical identities do not match the frozen batting order', () => {
    const clueSnapshot = createClueSnapshot();
    const mismatched = {
      ...clueSnapshot,
      pitches: clueSnapshot.pitches.map((pitch, index) => (
        index === 4
          ? { ...pitch, canonicalPlayerId: 'different-player' }
          : pitch
      )),
    };

    expect(() => createPermanentDailyClueFrozenIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: mismatched,
      issuedAt: '2030-04-05T07:00:00.000Z',
    })).toThrow('does not match frozen batting order');
  });

  it('treats an exact clue-frozen retry as idempotent while preserving first issue time', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyClueFrozenIssuedPuzzleService(repository);
    const input = {
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
    };

    const created = await service.issue({
      ...input,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    const existing = await service.issue({
      ...input,
      issuedAt: '2030-04-05T08:00:00.000Z',
    });

    expect(created).toMatchObject({ ok: true, status: 'created' });
    expect(existing).toMatchObject({
      ok: true,
      status: 'existing',
      puzzle: { issuedAt: '2030-04-05T07:00:00.000Z' },
    });
  });

  it('rejects a later attempt to rewrite frozen clue content', async () => {
    const repository = new InMemoryIssuedPuzzleRepository();
    const service = createPermanentDailyClueFrozenIssuedPuzzleService(repository);
    const clueSnapshot = createClueSnapshot();

    await service.issue({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });

    const changedClues = {
      ...clueSnapshot,
      pitches: clueSnapshot.pitches.map((pitch, index) => (
        index === 0 ? { ...pitch, initials: 'ZZ' } : pitch
      )),
    };
    const result = await service.issue({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: changedClues,
      issuedAt: '2030-04-05T08:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected immutable conflict.');
    expect(result.existing).toMatchObject({
      schemaVersion: 2,
      clueSnapshot: { pitches: [{ initials: 'P1' }] },
    });
    expect(result.requested.clueSnapshot.pitches[0]?.initials).toBe('ZZ');
  });

  it('treats an existing schema-v1 row as an immutable conflict, not an idempotent v2 retry', async () => {
    const existingV1 = createPermanentDailyIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    const repository = new InMemoryIssuedPuzzleRepository(existingV1);
    const service = createPermanentDailyClueFrozenIssuedPuzzleService(repository);

    const result = await service.issue({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2030-04-05T08:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected schema collision conflict.');
    expect(result.existing.schemaVersion).toBe(1);
    expect(result.requested.schemaVersion).toBe(2);
  });

  it('defensively clones v2 clue data while retaining the existing v1 record shape', () => {
    const v1 = createPermanentDailyIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      issuedAt: '2030-04-05T07:00:00.000Z',
    });
    const v2 = createPermanentDailyClueFrozenIssuedPuzzle({
      identity: requireIdentity(),
      canonicalPlayerIds: PLAYER_IDS,
      clueSnapshot: createClueSnapshot(),
      issuedAt: '2030-04-05T07:00:00.000Z',
    });

    const v1Clone = clonePermanentDailyIssuedPuzzleRecord(v1);
    const v2Clone = clonePermanentDailyIssuedPuzzleRecord(v2);

    expect(v1Clone).toEqual(v1);
    expect(v1Clone).not.toHaveProperty('clueSnapshot');
    expect(v2Clone).toEqual(v2);
    expect(v2Clone).not.toBe(v2);

    if (v2Clone.schemaVersion !== PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION) {
      throw new Error('Expected clue-frozen v2 clone.');
    }
    expect(v2Clone.clueSnapshot).not.toBe(v2.clueSnapshot);
    expect(v2Clone.clueSnapshot.pitches).not.toBe(v2.clueSnapshot.pitches);
    expect(v2Clone.clueSnapshot.pitches[0]?.hintValues)
      .not.toBe(v2.clueSnapshot.pitches[0]?.hintValues);
  });
});

function requireIdentity() {
  const identity = resolvePermanentDailyIdentityForDate(
    '2030-04-05',
    createPermanentDailyLaunchEpoch('2030-04-05'),
  );
  if (identity === null) throw new Error('Expected permanent Daily identity.');
  return identity;
}

function createClueSnapshot(): PermanentDailyIssuedClueSnapshot {
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
      hintValues: [
        '2000s',
        'SEA, CIN',
        index === 8 ? 'P' : 'CF',
        index === 8
          ? 'W 100 / L 80 / SV 0 / ERA 3.50 / WHIP 1.20 / K 1500'
          : 'HR 300 / RBI 900 / SB 50 / BA .280 / OBP .350',
      ],
    })),
  });
}


class InMemoryIssuedPuzzleRepository implements PermanentDailyIssuedPuzzleRepository {
  constructor(private stored: PermanentDailyIssuedPuzzleRecord | null = null) {}

  async insertIfAbsent(
    puzzle: PermanentDailyIssuedPuzzleRecord,
  ): Promise<PermanentDailyIssuedPuzzleRepositoryInsertResult> {
    if (this.stored !== null) {
      return { status: 'existing', puzzle: this.stored };
    }
    this.stored = puzzle;
    return { status: 'inserted', puzzle };
  }
}
