import {
  ARCHIVE_BETA_DAILY_SERIES_VERSION,
  type ArchiveBetaDailyIdentity,
} from './archiveBetaDailyIdentity';
import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import {
  CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION,
  areClueFrozenIssuedDailyPuzzlesExactlyEqual,
  cloneIssuedDailyPuzzleRecord,
  createClueFrozenIssuedDailyPuzzle,
  hasSameImmutableClueFrozenIssuedDailyContent,
  type ClueFrozenIssuedDailyPuzzle,
  type ClueFrozenIssuedDailyPuzzleInput,
} from './issuedDailyPuzzleCore';

export const ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION =
  CLUE_FROZEN_ISSUED_DAILY_PUZZLE_SCHEMA_VERSION;

export type ArchiveBetaDailyClueFrozenIssuedPuzzleInput =
  ClueFrozenIssuedDailyPuzzleInput<ArchiveBetaDailyIdentity>;

export type ArchiveBetaDailyClueFrozenIssuedPuzzle =
  ClueFrozenIssuedDailyPuzzle<ArchiveBetaDailyIdentity>;

export type ArchiveBetaDailyIssuedPuzzleRepositoryInsertResult =
  | { status: 'inserted'; puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle }
  | { status: 'existing'; puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle };

export interface ArchiveBetaDailyIssuedPuzzleRepository {
  insertIfAbsent(
    puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle,
  ): Promise<ArchiveBetaDailyIssuedPuzzleRepositoryInsertResult>;
}

export type ArchiveBetaDailyClueFrozenIssuedPuzzleStoreResult =
  | {
      ok: true;
      status: 'created' | 'existing';
      puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle;
    }
  | {
      ok: false;
      error: 'immutable_conflict';
      requested: ArchiveBetaDailyClueFrozenIssuedPuzzle;
      existing: ArchiveBetaDailyClueFrozenIssuedPuzzle;
    };

export type ArchiveBetaDailyClueFrozenIssuedPuzzleService = {
  issue(
    input: ArchiveBetaDailyClueFrozenIssuedPuzzleInput,
  ): Promise<ArchiveBetaDailyClueFrozenIssuedPuzzleStoreResult>;
};

export function createArchiveBetaDailyClueFrozenIssuedPuzzle(
  input: ArchiveBetaDailyClueFrozenIssuedPuzzleInput,
): ArchiveBetaDailyClueFrozenIssuedPuzzle {
  requireArchiveBetaSeries(input.identity);
  return createClueFrozenIssuedDailyPuzzle(input);
}

/**
 * First-write-wins archive-beta service.
 *
 * Beta begins at schema v2. Exact retries preserve the first issue timestamp;
 * any lineup or clue change is an immutable conflict.
 */
export function createArchiveBetaDailyClueFrozenIssuedPuzzleService(
  repository: ArchiveBetaDailyIssuedPuzzleRepository,
): ArchiveBetaDailyClueFrozenIssuedPuzzleService {
  return {
    async issue(input) {
      const requested = createArchiveBetaDailyClueFrozenIssuedPuzzle(input);
      const stored = await repository.insertIfAbsent(requested);
      requireArchiveBetaClueFrozenSchema(stored.puzzle);

      if (stored.status === 'inserted') {
        if (!areClueFrozenIssuedDailyPuzzlesExactlyEqual(stored.puzzle, requested)) {
          throw new Error(
            'Archive beta Daily issued-puzzle repository returned a different inserted puzzle.',
          );
        }
        return {
          ok: true,
          status: 'created',
          puzzle: cloneArchiveBetaDailyClueFrozenIssuedPuzzle(stored.puzzle),
        };
      }

      if (hasSameImmutableClueFrozenIssuedDailyContent(stored.puzzle, requested)) {
        return {
          ok: true,
          status: 'existing',
          puzzle: cloneArchiveBetaDailyClueFrozenIssuedPuzzle(stored.puzzle),
        };
      }

      return {
        ok: false,
        error: 'immutable_conflict',
        requested,
        existing: cloneArchiveBetaDailyClueFrozenIssuedPuzzle(stored.puzzle),
      };
    },
  };
}

function requireArchiveBetaClueFrozenSchema(
  puzzle: { schemaVersion: unknown },
): void {
  if (
    puzzle.schemaVersion
    !== ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION
  ) {
    throw new Error(
      `Unsupported archive beta Daily issued-puzzle schema version: ${String(
        puzzle.schemaVersion,
      )}.`,
    );
  }
}

function requireArchiveBetaSeries(identity: { seriesVersion: unknown }): void {
  if (identity.seriesVersion !== ARCHIVE_BETA_DAILY_SERIES_VERSION) {
    throw new Error(
      `Unsupported archive beta Daily series version: ${String(identity.seriesVersion)}.`,
    );
  }
}

export function cloneArchiveBetaDailyClueFrozenIssuedPuzzle(
  puzzle: ArchiveBetaDailyClueFrozenIssuedPuzzle,
): ArchiveBetaDailyClueFrozenIssuedPuzzle {
  const cloned = cloneIssuedDailyPuzzleRecord(puzzle);
  if (cloned.schemaVersion !== ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION) {
    throw new Error('Expected a clue-frozen archive beta Daily puzzle.');
  }
  return cloned;
}

export type {
  PermanentDailyIssuedClueSnapshot,
};
