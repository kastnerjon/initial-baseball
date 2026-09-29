import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';
import {
  CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
  ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
  areIssuedDailyPuzzlesExactlyEqual,
  cloneIssuedDailyPuzzleRecord,
  createClueFrozenIssuedDailyPuzzle,
  createIssuedDailyPuzzle,
  createIssuedDailyPuzzleId,
  hasSameImmutableIssuedDailyPuzzleContent,
  type ClueFrozenIssuedDailyPuzzle,
  type ClueFrozenIssuedDailyPuzzleInput,
  type IssuedDailyPuzzle,
  type IssuedDailyPuzzleInput,
  type IssuedDailyPuzzleRecord,
  type IssuedDailyPuzzleRepository,
  type IssuedDailyPuzzleRepositoryInsertResult,
} from './issuedDailyPuzzleCore';

export const PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION =
  ISSUED_DAILY_PUZZLE_SCHEMA_VERSION;
export const PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION =
  CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION;

export type PermanentDailyIssuedPuzzleInput =
  IssuedDailyPuzzleInput<PermanentDailyIdentity>;

export type PermanentDailyClueFrozenIssuedPuzzleInput =
  ClueFrozenIssuedDailyPuzzleInput<PermanentDailyIdentity>;

export type PermanentDailyIssuedPuzzle =
  IssuedDailyPuzzle<PermanentDailyIdentity>;

export type PermanentDailyClueFrozenIssuedPuzzle =
  ClueFrozenIssuedDailyPuzzle<PermanentDailyIdentity>;

export type PermanentDailyIssuedPuzzleRecord =
  IssuedDailyPuzzleRecord<PermanentDailyIdentity>;

export interface PermanentDailyIssuedPuzzleRepository
  extends IssuedDailyPuzzleRepository<PermanentDailyIdentity> {}

export type PermanentDailyIssuedPuzzleRepositoryInsertResult =
  IssuedDailyPuzzleRepositoryInsertResult<PermanentDailyIdentity>;

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
          || !areIssuedDailyPuzzlesExactlyEqual(stored.puzzle, requested)
        ) {
          throw new Error(
            'Permanent Daily issued-puzzle repository returned a different inserted puzzle.',
          );
        }
        return {
          ok: true,
          status: 'created',
          puzzle: clonePermanentIssuedPuzzle(stored.puzzle),
        };
      }

      if (
        stored.puzzle.schemaVersion === PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION
        && hasSameImmutableIssuedDailyPuzzleContent(stored.puzzle, requested)
      ) {
        return {
          ok: true,
          status: 'existing',
          puzzle: clonePermanentIssuedPuzzle(stored.puzzle),
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
  requirePermanentSeries(input.identity);
  return createIssuedDailyPuzzle(input);
}

export function createPermanentDailyClueFrozenIssuedPuzzle(
  input: PermanentDailyClueFrozenIssuedPuzzleInput,
): PermanentDailyClueFrozenIssuedPuzzle {
  requirePermanentSeries(input.identity);
  return createClueFrozenIssuedDailyPuzzle(input);
}

export function clonePermanentDailyIssuedPuzzleRecord(
  puzzle: PermanentDailyIssuedPuzzleRecord,
): PermanentDailyIssuedPuzzleRecord {
  return cloneIssuedDailyPuzzleRecord(puzzle);
}

export function createPermanentDailyPuzzleId(
  identity: PermanentDailyIdentity,
): string {
  requirePermanentSeries(identity);
  return createIssuedDailyPuzzleId(identity);
}

function requirePermanentSeries(identity: { seriesVersion: unknown }): void {
  if (identity.seriesVersion !== PERMANENT_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported Permanent Daily series version: ${String(identity.seriesVersion)}.`,
    );
  }
}

function clonePermanentIssuedPuzzle(
  puzzle: PermanentDailyIssuedPuzzle,
): PermanentDailyIssuedPuzzle {
  const cloned = cloneIssuedDailyPuzzleRecord(puzzle);
  if (cloned.schemaVersion !== PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION) {
    throw new Error('Expected a schema-v1 permanent Daily puzzle.');
  }
  return cloned;
}

export type {
  PermanentDailyIssuedClueSnapshot,
};
