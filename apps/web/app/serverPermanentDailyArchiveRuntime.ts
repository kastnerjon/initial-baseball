import 'server-only';
import { PERMANENT_DAILY_SERIES_VERSION } from '@initial-baseball/daily';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import type { DailyRuntimeService } from './dailyRuntimeContracts';
import {
  createDailyProgressionTokenCodec,
  type DailyProgressionTokenCodec,
} from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import {
  DailyRuntimeRequestError,
  createDailyRuntimeService,
} from './dailyRuntimeService';
import {
  getCanonicalRevealReader,
  getCanonicalRuntime,
} from './serverCanonicalData';
import {
  createServerPermanentDailyArchivePuzzleSource,
  type ServerPermanentDailyArchivePuzzleSource,
} from './serverPermanentDailyArchivePuzzleSource';

type CreateServerPermanentDailyArchiveRuntimeOptions = {
  environment?: Record<string, string | undefined>;
  source?: ServerPermanentDailyArchivePuzzleSource;
  progressionTokens?: DailyProgressionTokenCodec;
  resolveLegacyPlayerId?: (playerId: string) => string;
  getCanonicalReveal?: (canonicalPlayerId: string) => CanonicalPlayerReveal;
};

/**
 * Server-only gameplay runtime for already-issued permanent Daily puzzles.
 *
 * The existing Daily runtime remains authoritative for public-puzzle redaction,
 * hint authorization, signed progression, guess resolution, and completion.
 * Only puzzle loading changes: it must resolve an issued permanent-v1 snapshot.
 */
export function createServerPermanentDailyArchiveRuntime({
  environment = process.env,
  source = createServerPermanentDailyArchivePuzzleSource(),
  progressionTokens = createDailyProgressionTokenCodec(
    getDailyProgressionSecret(environment),
  ),
  resolveLegacyPlayerId = playerId => (
    getCanonicalRuntime().requireCanonicalPlayerId(playerId)
  ),
  getCanonicalReveal = playerId => getCanonicalRevealReader().getReveal(playerId),
}: CreateServerPermanentDailyArchiveRuntimeOptions = {}): DailyRuntimeService {
  return createDailyRuntimeService({
    resolveLegacyPlayerId,
    getCanonicalReveal,
    progressionTokens,
    createPuzzle: async (puzzleDate) => {
      const puzzle = await source.getByDate({
        seriesVersion: PERMANENT_DAILY_SERIES_VERSION,
        puzzleDate,
      });
      if (puzzle === null) {
        throw new DailyRuntimeRequestError(
          `Permanent Daily puzzle ${puzzleDate} has not been issued.`,
        );
      }
      return puzzle;
    },
  });
}
