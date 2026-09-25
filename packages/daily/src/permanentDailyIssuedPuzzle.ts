import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';
import {
  clonePermanentDailyIssuedClueSnapshot,
  type PermanentDailyIssuedClueSnapshot,
} from './permanentDailyIssuedClueSnapshot';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';

export const PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION = 1 as const;
export const PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION = 2 as const;

export type PermanentDailyIssuedPuzzleInput = {
  identity: PermanentDailyIdentity;
  canonicalPlayerIds: readonly string[];
  issuedAt: string;
};

export type PermanentDailyClueFrozenIssuedPuzzleInput = PermanentDailyIssuedPuzzleInput & {
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
};

export type PermanentDailyIssuedPuzzle = {
  schemaVersion: typeof PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION;
  puzzleId: string;
  identity: PermanentDailyIdentity;
  canonicalPlayerIds: readonly string[];
  issuedAt: string;
};

export type PermanentDailyClueFrozenIssuedPuzzle = {
  schemaVersion: typeof PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION;
  puzzleId: string;
  identity: PermanentDailyIdentity;
  canonicalPlayerIds: readonly string[];
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
  issuedAt: string;
};

export type PermanentDailyIssuedPuzzleRecord =
  | PermanentDailyIssuedPuzzle
  | PermanentDailyClueFrozenIssuedPuzzle;

export type PermanentDailyIssuedPuzzleRepositoryInsertResult =
  | { status: 'inserted'; puzzle: PermanentDailyIssuedPuzzleRecord }
  | { status: 'existing'; puzzle: PermanentDailyIssuedPuzzleRecord };

/**
 * Provider-neutral first-write-wins persistence boundary for one permanent Daily.
 *
 * Implementations must atomically preserve the first puzzle stored for a permanent
 * identity. A later write may return the existing row, but must never overwrite it.
 */
export interface PermanentDailyIssuedPuzzleRepository {
  insertIfAbsent(
    puzzle: PermanentDailyIssuedPuzzleRecord,
  ): Promise<PermanentDailyIssuedPuzzleRepositoryInsertResult>;
}

export type PermanentDailyIssuedPuzzleStoreResult =
  | {
      ok: true;
      status: 'created' | 'existing';
      puzzle: PermanentDailyIssuedPuzzle;
    }
  | {
      ok: false;
      error: 'immutable_conflict';
      requested: PermanentDailyIssuedPuzzle;
      existing: PermanentDailyIssuedPuzzleRecord;
    };

export type PermanentDailyIssuedPuzzleService = {
  issue(input: PermanentDailyIssuedPuzzleInput): Promise<PermanentDailyIssuedPuzzleStoreResult>;
};

export type PermanentDailyClueFrozenIssuedPuzzleStoreResult =
  | {
      ok: true;
      status: 'created' | 'existing';
      puzzle: PermanentDailyClueFrozenIssuedPuzzle;
    }
  | {
      ok: false;
      error: 'immutable_conflict';
      requested: PermanentDailyClueFrozenIssuedPuzzle;
      existing: PermanentDailyIssuedPuzzleRecord;
    };

export type PermanentDailyClueFrozenIssuedPuzzleService = {
  issue(
    input: PermanentDailyClueFrozenIssuedPuzzleInput,
  ): Promise<PermanentDailyClueFrozenIssuedPuzzleStoreResult>;
};

export function createPermanentDailyIssuedPuzzleService(
  repository: PermanentDailyIssuedPuzzleRepository,
): PermanentDailyIssuedPuzzleService {
  return {
    async issue(input) {
      const requested = createPermanentDailyIssuedPuzzle(input);
      const stored = await repository.insertIfAbsent(requested);

      if (stored.status === 'inserted') {
        if (
          stored.puzzle.schemaVersion !== PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION
          || !arePermanentDailyIssuedPuzzlesExactlyEqual(stored.puzzle, requested)
        ) {
          throw new Error(
            'Permanent Daily issued-puzzle repository returned a different inserted puzzle.',
          );
        }
        return { ok: true, status: 'created', puzzle: cloneIssuedPuzzle(stored.puzzle) };
      }

      if (
        stored.puzzle.schemaVersion === PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION
        && hasSameImmutablePuzzleContent(stored.puzzle, requested)
      ) {
        return { ok: true, status: 'existing', puzzle: cloneIssuedPuzzle(stored.puzzle) };
      }

      return {
        ok: false,
        error: 'immutable_conflict',
        requested,
        existing: clonePermanentDailyIssuedPuzzleRecord(stored.puzzle),
      };
    },
  };
}

export function createPermanentDailyClueFrozenIssuedPuzzleService(
  repository: PermanentDailyIssuedPuzzleRepository,
): PermanentDailyClueFrozenIssuedPuzzleService {
  return {
    async issue(input) {
      const requested = createPermanentDailyClueFrozenIssuedPuzzle(input);
      const stored = await repository.insertIfAbsent(requested);

      if (stored.status === 'inserted') {
        if (
          stored.puzzle.schemaVersion !== PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
          || !arePermanentDailyClueFrozenIssuedPuzzlesExactlyEqual(stored.puzzle, requested)
        ) {
          throw new Error(
            'Permanent Daily issued-puzzle repository returned a different inserted clue-frozen puzzle.',
          );
        }
        return {
          ok: true,
          status: 'created',
          puzzle: cloneClueFrozenIssuedPuzzle(stored.puzzle),
        };
      }

      if (
        stored.puzzle.schemaVersion === PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
        && hasSameClueFrozenImmutablePuzzleContent(stored.puzzle, requested)
      ) {
        return {
          ok: true,
          status: 'existing',
          puzzle: cloneClueFrozenIssuedPuzzle(stored.puzzle),
        };
      }

      return {
        ok: false,
        error: 'immutable_conflict',
        requested,
        existing: clonePermanentDailyIssuedPuzzleRecord(stored.puzzle),
      };
    },
  };
}

export function createPermanentDailyIssuedPuzzle(
  input: PermanentDailyIssuedPuzzleInput,
): PermanentDailyIssuedPuzzle {
  validatePermanentDailyIdentity(input.identity);
  validateCanonicalPlayerIds(input.canonicalPlayerIds);
  const issuedAt = normalizeIssuedAt(input.issuedAt);

  return {
    schemaVersion: PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
    puzzleId: createPermanentDailyPuzzleId(input.identity),
    identity: { ...input.identity },
    canonicalPlayerIds: [...input.canonicalPlayerIds],
    issuedAt,
  };
}

export function createPermanentDailyClueFrozenIssuedPuzzle(
  input: PermanentDailyClueFrozenIssuedPuzzleInput,
): PermanentDailyClueFrozenIssuedPuzzle {
  const legacyEnvelope = createPermanentDailyIssuedPuzzle(input);
  const clueSnapshot = clonePermanentDailyIssuedClueSnapshot(input.clueSnapshot);

  clueSnapshot.pitches.forEach((pitch, index) => {
    const canonicalPlayerId = legacyEnvelope.canonicalPlayerIds[index];
    if (pitch.canonicalPlayerId !== canonicalPlayerId) {
      throw new Error(
        `Permanent Daily clue snapshot player at pitch ${pitch.pitchNumber} does not match frozen batting order.`,
      );
    }
  });

  return {
    ...legacyEnvelope,
    schemaVersion: PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
    clueSnapshot,
  };
}

export function clonePermanentDailyIssuedPuzzleRecord(
  puzzle: PermanentDailyIssuedPuzzleRecord,
): PermanentDailyIssuedPuzzleRecord {
  const common = {
    puzzleId: puzzle.puzzleId,
    identity: { ...puzzle.identity },
    canonicalPlayerIds: [...puzzle.canonicalPlayerIds],
    issuedAt: puzzle.issuedAt,
  };

  if (puzzle.schemaVersion === PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION) {
    return {
      ...common,
      schemaVersion: PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
    };
  }

  return {
    ...common,
    schemaVersion: PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
    clueSnapshot: clonePermanentDailyIssuedClueSnapshot(puzzle.clueSnapshot),
  };
}

export function createPermanentDailyPuzzleId(
  identity: PermanentDailyIdentity,
): string {
  validatePermanentDailyIdentity(identity);
  return `${identity.seriesVersion}-daily-${identity.dailyNumber}`;
}

function hasSameImmutablePuzzleContent(
  left: PermanentDailyIssuedPuzzle,
  right: PermanentDailyIssuedPuzzle,
): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.puzzleId === right.puzzleId
    && left.identity.seriesVersion === right.identity.seriesVersion
    && left.identity.puzzleDate === right.identity.puzzleDate
    && left.identity.dailyNumber === right.identity.dailyNumber
    && areCanonicalPlayerIdsEqual(left.canonicalPlayerIds, right.canonicalPlayerIds);
}

function arePermanentDailyIssuedPuzzlesExactlyEqual(
  left: PermanentDailyIssuedPuzzle,
  right: PermanentDailyIssuedPuzzle,
): boolean {
  return hasSameImmutablePuzzleContent(left, right)
    && left.issuedAt === right.issuedAt;
}

function hasSameClueFrozenImmutablePuzzleContent(
  left: PermanentDailyClueFrozenIssuedPuzzle,
  right: PermanentDailyClueFrozenIssuedPuzzle,
): boolean {
  return left.puzzleId === right.puzzleId
    && left.identity.seriesVersion === right.identity.seriesVersion
    && left.identity.puzzleDate === right.identity.puzzleDate
    && left.identity.dailyNumber === right.identity.dailyNumber
    && areCanonicalPlayerIdsEqual(left.canonicalPlayerIds, right.canonicalPlayerIds)
    && areClueSnapshotsEqual(left.clueSnapshot, right.clueSnapshot);
}

function arePermanentDailyClueFrozenIssuedPuzzlesExactlyEqual(
  left: PermanentDailyClueFrozenIssuedPuzzle,
  right: PermanentDailyClueFrozenIssuedPuzzle,
): boolean {
  return hasSameClueFrozenImmutablePuzzleContent(left, right)
    && left.issuedAt === right.issuedAt;
}

function areClueSnapshotsEqual(
  left: PermanentDailyIssuedClueSnapshot,
  right: PermanentDailyIssuedClueSnapshot,
): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.hintLayout.length === right.hintLayout.length
    && left.hintLayout.every((slot, index) => {
      const other = right.hintLayout[index];
      return other !== undefined
        && slot.slot === other.slot
        && slot.hintType === other.hintType
        && slot.displayLabel === other.displayLabel;
    })
    && left.pitches.length === right.pitches.length
    && left.pitches.every((pitch, index) => {
      const other = right.pitches[index];
      return other !== undefined
        && pitch.pitchNumber === other.pitchNumber
        && pitch.canonicalPlayerId === other.canonicalPlayerId
        && pitch.initials === other.initials
        && pitch.hintValues.length === other.hintValues.length
        && pitch.hintValues.every((value, hintIndex) => value === other.hintValues[hintIndex]);
    });
}

function areCanonicalPlayerIdsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validatePermanentDailyIdentity(identity: PermanentDailyIdentity): void {
  if (identity.seriesVersion !== PERMANENT_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported Permanent Daily series version: ${String(identity.seriesVersion)}.`,
    );
  }
  if (!Number.isSafeInteger(identity.dailyNumber) || identity.dailyNumber < 1) {
    throw new Error('Permanent Daily number must be a positive safe integer.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(identity.puzzleDate)) {
    throw new Error('Permanent Daily puzzle date must use YYYY-MM-DD.');
  }

  const timestamp = Date.parse(`${identity.puzzleDate}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== identity.puzzleDate
  ) {
    throw new Error('Permanent Daily puzzle date is not a valid calendar date.');
  }
}

function validateCanonicalPlayerIds(canonicalPlayerIds: readonly string[]): void {
  if (canonicalPlayerIds.length !== DAILY_AT_BAT_COUNT) {
    throw new Error(
      `Permanent Daily issued puzzle must contain exactly ${DAILY_AT_BAT_COUNT} players.`,
    );
  }

  const seen = new Set<string>();
  for (const canonicalPlayerId of canonicalPlayerIds) {
    if (canonicalPlayerId.trim().length === 0) {
      throw new Error('Permanent Daily canonical player ID is required.');
    }
    if (seen.has(canonicalPlayerId)) {
      throw new Error(`Duplicate permanent Daily canonical player: ${canonicalPlayerId}.`);
    }
    seen.add(canonicalPlayerId);
  }
}

function normalizeIssuedAt(issuedAt: string): string {
  const timestamp = Date.parse(issuedAt);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid permanent Daily issued timestamp: ${issuedAt}.`);
  }
  return new Date(timestamp).toISOString();
}

function cloneIssuedPuzzle(
  puzzle: PermanentDailyIssuedPuzzle,
): PermanentDailyIssuedPuzzle {
  return {
    ...puzzle,
    identity: { ...puzzle.identity },
    canonicalPlayerIds: [...puzzle.canonicalPlayerIds],
  };
}

function cloneClueFrozenIssuedPuzzle(
  puzzle: PermanentDailyClueFrozenIssuedPuzzle,
): PermanentDailyClueFrozenIssuedPuzzle {
  return {
    ...puzzle,
    identity: { ...puzzle.identity },
    canonicalPlayerIds: [...puzzle.canonicalPlayerIds],
    clueSnapshot: clonePermanentDailyIssuedClueSnapshot(puzzle.clueSnapshot),
  };
}
