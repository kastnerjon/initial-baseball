import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import {
  createPermanentDailyClueFrozenIssuedPuzzleService,
  type PermanentDailyClueFrozenIssuedPuzzleStoreResult,
} from './permanentDailyClueFrozenIssuedPuzzleService';
import {
  createPermanentDailyIssuedPuzzleService,
  type PermanentDailyIssuedPuzzleRepository,
  type PermanentDailyIssuedPuzzleStoreResult,
} from './permanentDailyIssuedPuzzle';
import type { PermanentDailyIdentity } from './permanentDailyIdentity';
import {
  resolveIssuedDailyIssuanceLineup,
  type IssuedDailyIssuanceEditorialPuzzle,
} from './issuedDailyIssuanceCore';

export type PermanentDailyIssuanceEditorialPuzzle =
  IssuedDailyIssuanceEditorialPuzzle;

export type PermanentDailyIssuanceInput = {
  identity: PermanentDailyIdentity;
  editorialPuzzle: PermanentDailyIssuanceEditorialPuzzle;
  issuedAt: string;
};

export type PermanentDailyIssuanceService = {
  issue(input: PermanentDailyIssuanceInput): Promise<PermanentDailyIssuedPuzzleStoreResult>;
};

export type PermanentDailyClueFrozenIssuanceInput = PermanentDailyIssuanceInput & {
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
};

export type PermanentDailyClueFrozenIssuanceService = {
  issue(
    input: PermanentDailyClueFrozenIssuanceInput,
  ): Promise<PermanentDailyClueFrozenIssuedPuzzleStoreResult>;
};

/**
 * Portable orchestration boundary that freezes one already-resolved permanent
 * Daily identity from an eligible editorial lineup.
 *
 * Launch-epoch/configuration policy is deliberately outside this service. The
 * caller must supply the permanent identity explicitly.
 */
export function createPermanentDailyIssuanceService(
  repository: PermanentDailyIssuedPuzzleRepository,
): PermanentDailyIssuanceService {
  const issuedPuzzleService = createPermanentDailyIssuedPuzzleService(repository);

  return {
    async issue(input) {
      const canonicalPlayerIds = resolveIssuedDailyIssuanceLineup(
        input.identity,
        input.editorialPuzzle,
        'Permanent Daily',
      );

      return issuedPuzzleService.issue({
        identity: input.identity,
        canonicalPlayerIds,
        issuedAt: input.issuedAt,
      });
    },
  };
}

/**
 * Portable schema-v2 issuance boundary.
 *
 * The caller supplies the already-materialized public clue snapshot. This layer
 * owns editorial eligibility/order validation and immutable v2 persistence, but
 * deliberately does not know how web/player-data code produced those clues.
 */
export function createPermanentDailyClueFrozenIssuanceService(
  repository: PermanentDailyIssuedPuzzleRepository,
): PermanentDailyClueFrozenIssuanceService {
  const issuedPuzzleService = createPermanentDailyClueFrozenIssuedPuzzleService(repository);

  return {
    async issue(input) {
      const canonicalPlayerIds = resolveIssuedDailyIssuanceLineup(
        input.identity,
        input.editorialPuzzle,
        'Permanent Daily',
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
