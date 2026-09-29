import {
  createArchiveBetaDailyClueFrozenIssuedPuzzleService,
  type ArchiveBetaDailyClueFrozenIssuedPuzzleStoreResult,
  type ArchiveBetaDailyIssuedPuzzleRepository,
} from './archiveBetaDailyIssuedPuzzle';
import type { ArchiveBetaDailyIdentity } from './archiveBetaDailyIdentity';
import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import {
  resolveIssuedDailyIssuanceLineup,
  type IssuedDailyIssuanceEditorialPuzzle,
} from './issuedDailyIssuanceCore';

export type ArchiveBetaDailyIssuanceEditorialPuzzle =
  IssuedDailyIssuanceEditorialPuzzle;

export type ArchiveBetaDailyClueFrozenIssuanceInput = {
  identity: ArchiveBetaDailyIdentity;
  editorialPuzzle: ArchiveBetaDailyIssuanceEditorialPuzzle;
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
  issuedAt: string;
};

export type ArchiveBetaDailyClueFrozenIssuanceService = {
  issue(
    input: ArchiveBetaDailyClueFrozenIssuanceInput,
  ): Promise<ArchiveBetaDailyClueFrozenIssuedPuzzleStoreResult>;
};

/**
 * Portable schema-v2 archive-beta issuance orchestration.
 *
 * The caller supplies an already-resolved beta identity and already-materialized
 * public clue snapshot. Epoch activation and web/player-data materialization are
 * deliberately outside this boundary.
 */
export function createArchiveBetaDailyClueFrozenIssuanceService(
  repository: ArchiveBetaDailyIssuedPuzzleRepository,
): ArchiveBetaDailyClueFrozenIssuanceService {
  const issuedPuzzleService = createArchiveBetaDailyClueFrozenIssuedPuzzleService(
    repository,
  );

  return {
    async issue(input) {
      const canonicalPlayerIds = resolveIssuedDailyIssuanceLineup(
        input.identity,
        input.editorialPuzzle,
        'Archive beta Daily',
      );

      return issuedPuzzleService.issue({
        identity: input.identity,
        canonicalPlayerIds,
        clueSnapshot: input.clueSnapshot,
        issuedAt: input.issuedAt,
      });
    },
  };
}
