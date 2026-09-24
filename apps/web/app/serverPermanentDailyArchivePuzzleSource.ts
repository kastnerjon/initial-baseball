import 'server-only';
import type {
  PermanentDailyIssuedPuzzle,
  PermanentDailyIssuedPuzzleDateQuery,
  PermanentDailyIssuedPuzzleNumberQuery,
  PermanentDailyIssuedPuzzleReadService,
} from '@initial-baseball/daily';
import type { DailyPuzzle } from '@initial-baseball/shared';
import { materializePermanentDailyIssuedPuzzle } from './permanentDailyPuzzleMaterialization';
import {
  createServerPermanentDailyIssuedPuzzleReadService,
} from './serverPermanentDailyIssuedPuzzleRead';

export type ServerPermanentDailyArchivePuzzleSource = {
  getByNumber(
    query: PermanentDailyIssuedPuzzleNumberQuery,
  ): Promise<DailyPuzzle | null>;
  getByDate(
    query: PermanentDailyIssuedPuzzleDateQuery,
  ): Promise<DailyPuzzle | null>;
};

interface ServerPermanentDailyArchivePuzzleSourceDependencies {
  createReadService: () => PermanentDailyIssuedPuzzleReadService;
  materializePuzzle: (puzzle: PermanentDailyIssuedPuzzle) => DailyPuzzle;
}

type CreateServerPermanentDailyArchivePuzzleSourceOptions = {
  dependencies?: ServerPermanentDailyArchivePuzzleSourceDependencies;
};

const DEFAULT_DEPENDENCIES: ServerPermanentDailyArchivePuzzleSourceDependencies = {
  createReadService: createServerPermanentDailyIssuedPuzzleReadService,
  materializePuzzle: materializePermanentDailyIssuedPuzzle,
};

/**
 * Server-only source for gameplay-ready permanent archive puzzles.
 *
 * Frozen identity/order is read through the portable service, then materialized
 * through the existing canonical Daily player/hint path. No launch policy or
 * public route is introduced here.
 */
export function createServerPermanentDailyArchivePuzzleSource({
  dependencies = DEFAULT_DEPENDENCIES,
}: CreateServerPermanentDailyArchivePuzzleSourceOptions = {}): ServerPermanentDailyArchivePuzzleSource {
  const readService = dependencies.createReadService();

  return {
    async getByNumber(query) {
      return materializeIfIssued(
        await readService.getByNumber(query),
        dependencies.materializePuzzle,
      );
    },

    async getByDate(query) {
      return materializeIfIssued(
        await readService.getByDate(query),
        dependencies.materializePuzzle,
      );
    },
  };
}

function materializeIfIssued(
  issuedPuzzle: PermanentDailyIssuedPuzzle | null,
  materializePuzzle: (puzzle: PermanentDailyIssuedPuzzle) => DailyPuzzle,
): DailyPuzzle | null {
  return issuedPuzzle === null ? null : materializePuzzle(issuedPuzzle);
}
