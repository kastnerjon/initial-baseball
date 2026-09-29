import {
  PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
  type PermanentDailyIssuedPuzzleRecord,
} from './permanentDailyIssuedPuzzle';
import {
  PERMANENT_DAILY_SERIES_VERSION,
  type PermanentDailyIdentity,
} from './permanentDailyIdentity';
import {
  createIssuedDailyPuzzleReadService,
  type IssuedDailyPuzzleDateQuery,
  type IssuedDailyPuzzleNumberQuery,
  type IssuedDailyPuzzleReadRepository,
  type IssuedDailyPuzzleReadService,
} from './issuedDailyPuzzleReadCore';

export type PermanentDailyIssuedPuzzleNumberQuery =
  IssuedDailyPuzzleNumberQuery<PermanentDailyIdentity>;

export type PermanentDailyIssuedPuzzleDateQuery =
  IssuedDailyPuzzleDateQuery<PermanentDailyIdentity>;

/**
 * Provider-neutral read-only boundary for immutable permanent Daily puzzles.
 *
 * Number and date are both durable lookup keys stored with the frozen puzzle.
 * Callers do not need a configured launch epoch merely to retrieve an already
 * issued row.
 */
export interface PermanentDailyIssuedPuzzleReadRepository
  extends IssuedDailyPuzzleReadRepository<
    PermanentDailyIdentity,
    PermanentDailyIssuedPuzzleRecord
  > {}

export type PermanentDailyIssuedPuzzleReadService =
  IssuedDailyPuzzleReadService<
    PermanentDailyIdentity,
    PermanentDailyIssuedPuzzleRecord
  >;

export function createPermanentDailyIssuedPuzzleReadService(
  repository: PermanentDailyIssuedPuzzleReadRepository,
): PermanentDailyIssuedPuzzleReadService {
  return createIssuedDailyPuzzleReadService({
    seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
    seriesLabel: 'Permanent Daily',
    supportedSchemaVersions: [
      PERMANENT_DAILY_ISSUED_PUZZLE_SCHEMA_VERSION,
      PERMANENT_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
    ],
    repository,
  });
}
