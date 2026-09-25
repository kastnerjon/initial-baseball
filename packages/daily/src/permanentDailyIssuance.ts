import { DAILY_AT_BAT_COUNT } from './dailyPuzzleSelection';
import type { DailyPuzzleEditorialRecord } from './dailyPuzzleLifecycle';
import type { PermanentDailyIssuedClueSnapshot } from './permanentDailyIssuedClueSnapshot';
import {
  createPermanentDailyClueFrozenIssuedPuzzleService,
  createPermanentDailyIssuedPuzzleService,
  type PermanentDailyClueFrozenIssuedPuzzleStoreResult,
  type PermanentDailyIssuedPuzzleRepository,
  type PermanentDailyIssuedPuzzleStoreResult,
} from './permanentDailyIssuedPuzzle';
import type { PermanentDailyIdentity } from './permanentDailyIdentity';

export type PermanentDailyIssuanceEditorialPuzzle = Pick<
  DailyPuzzleEditorialRecord,
  'puzzleDate' | 'status' | 'selections'
>;

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
      const canonicalPlayerIds = resolveIssuanceLineup(
        input.identity,
        input.editorialPuzzle,
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
      const canonicalPlayerIds = resolveIssuanceLineup(
        input.identity,
        input.editorialPuzzle,
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

function resolveIssuanceLineup(
  identity: PermanentDailyIdentity,
  puzzle: PermanentDailyIssuanceEditorialPuzzle,
): readonly string[] {
  if (puzzle.puzzleDate !== identity.puzzleDate) {
    throw new Error(
      `Permanent Daily identity date ${identity.puzzleDate} does not match editorial puzzle ${puzzle.puzzleDate}.`,
    );
  }

  if (puzzle.status !== 'scheduled' && puzzle.status !== 'published') {
    throw new Error(
      `Permanent Daily issuance requires a scheduled or published editorial puzzle; received ${puzzle.status}.`,
    );
  }

  if (puzzle.selections.length !== DAILY_AT_BAT_COUNT) {
    throw new Error(
      `Permanent Daily issuance requires exactly ${DAILY_AT_BAT_COUNT} editorial selections.`,
    );
  }

  const ordered = [...puzzle.selections].sort((left, right) => left.slot - right.slot);
  ordered.forEach((selection, index) => {
    const expectedSlot = index + 1;
    if (selection.slot !== expectedSlot) {
      throw new Error(
        `Permanent Daily issuance requires exact editorial slots 1 through ${DAILY_AT_BAT_COUNT}; expected slot ${expectedSlot} but received ${selection.slot}.`,
      );
    }
  });

  return ordered.map(selection => selection.canonicalPlayerId);
}
