import {
  ARCHIVE_BETA_DAILY_SERIES_VERSION,
  type ArchiveBetaDailyIdentity,
} from './archiveBetaDailyIdentity';
import {
  ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
} from './archiveBetaDailyIssuedPuzzle';
import {
  createIssuedDailyPuzzleReadService,
  type IssuedDailyPuzzleDateQuery,
  type IssuedDailyPuzzleNumberQuery,
  type IssuedDailyPuzzleReadRepository,
  type IssuedDailyPuzzleReadService,
} from './issuedDailyPuzzleReadCore';

export type ArchiveBetaDailyIssuedPuzzleNumberQuery =
  IssuedDailyPuzzleNumberQuery<ArchiveBetaDailyIdentity>;

export type ArchiveBetaDailyIssuedPuzzleDateQuery =
  IssuedDailyPuzzleDateQuery<ArchiveBetaDailyIdentity>;

export interface ArchiveBetaDailyIssuedPuzzleReadRepository
  extends IssuedDailyPuzzleReadRepository<
    ArchiveBetaDailyIdentity,
    ArchiveBetaDailyClueFrozenIssuedPuzzle
  > {}

export type ArchiveBetaDailyIssuedPuzzleReadService =
  IssuedDailyPuzzleReadService<
    ArchiveBetaDailyIdentity,
    ArchiveBetaDailyClueFrozenIssuedPuzzle
  >;

export function createArchiveBetaDailyIssuedPuzzleReadService(
  repository: ArchiveBetaDailyIssuedPuzzleReadRepository,
): ArchiveBetaDailyIssuedPuzzleReadService {
  return createIssuedDailyPuzzleReadService({
    seriesVersion: ARCHIVE_BETA_DAILY_SERIES_VERSION,
    seriesLabel: 'Archive beta Daily',
    supportedSchemaVersions: [
      ARCHIVE_BETA_DAILY_CLUE_FROZEN_ISSUED_PUZZLE_SCHEMA_VERSION,
    ],
    repository,
  });
}
