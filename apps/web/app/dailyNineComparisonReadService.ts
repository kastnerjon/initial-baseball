import {
  DAILY_AT_BAT_COUNT,
  type DailyNineComparisonService,
} from '@initial-baseball/daily';
import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  isDailyNineComparisonApiRulesetVersion,
  type DailyNineAtBatComparisonApiResponse,
  type DailyNineComparisonApiErrorCode,
  type DailyNineComparisonApiRulesetVersion,
  type DailyNineCompletedComparisonApiResponse,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { isArchiveBetaDailyPuzzleId } from './dailyGameplayPersistenceAuthority';

export type DailyNineComparisonRequestErrorCode = Exclude<
  DailyNineComparisonApiErrorCode,
  'comparison_unavailable'
>;

export class DailyNineComparisonRequestError extends Error {
  constructor(
    public readonly code: DailyNineComparisonRequestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DailyNineComparisonRequestError';
  }
}

type DailyNineComparisonBaseRequest = {
  puzzleId?: string | null;
  puzzleDate: string | null;
  rulesetVersion: string | null;
  excludedResultId?: string | null;
};

export type DailyNineAtBatComparisonReadRequest = DailyNineComparisonBaseRequest & {
  pitchNumber: string | null;
};

export type DailyNineCompletedComparisonReadRequest = DailyNineComparisonBaseRequest;

type CreateDailyNineComparisonReadServiceInput = {
  comparison: DailyNineComparisonService;
  loadAuthoritativePuzzle: (puzzleDate: string, puzzleId?: string) => Promise<DailyPublicPuzzle>;
  getCurrentDailyDate: () => string;
  now?: () => Date;
};

export function createDailyNineComparisonReadService({
  comparison,
  loadAuthoritativePuzzle,
  getCurrentDailyDate,
  now = () => new Date(),
}: CreateDailyNineComparisonReadServiceInput) {
  async function loadComparisonPuzzle(puzzleDate: string, puzzleId?: string): Promise<DailyPublicPuzzle> {
    const puzzle = await loadAuthoritativePuzzle(puzzleDate, puzzleId);
    if (puzzle.puzzleDate !== puzzleDate || (puzzleId !== undefined && puzzle.id !== puzzleId)) {
      throw new DailyNineComparisonRequestError(
        'invalid_puzzle',
        'Authoritative Daily puzzle does not match requested identity.',
      );
    }
    return puzzle;
  }

  return {
    async readAtBat(
      request: DailyNineAtBatComparisonReadRequest,
    ): Promise<DailyNineAtBatComparisonApiResponse> {
      const { puzzleId, puzzleDate, rulesetVersion, excludedResultId } = requireBaseRequest(
        request,
        getCurrentDailyDate(),
      );
      const pitchNumber = requirePitchNumber(request.pitchNumber);
      const puzzle = await loadComparisonPuzzle(puzzleDate, puzzleId);
      const sourceReadAt = requireIsoTimestamp(now());
      const aggregate = await comparison.getAtBat({
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion,
        pitchNumber,
        ...(excludedResultId === undefined ? {} : { excludedResultId }),
      });

      return {
        schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
        kind: 'at-bat',
        comparison: aggregate,
        freshness: {
          sourceReadAt,
          cacheStatus: 'live',
        },
      };
    },

    async readCompleted(
      request: DailyNineCompletedComparisonReadRequest,
    ): Promise<DailyNineCompletedComparisonApiResponse> {
      const { puzzleId, puzzleDate, rulesetVersion, excludedResultId } = requireBaseRequest(
        request,
        getCurrentDailyDate(),
      );
      const puzzle = await loadComparisonPuzzle(puzzleDate, puzzleId);
      const sourceReadAt = requireIsoTimestamp(now());
      const aggregate = await comparison.getCompletedGames({
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion,
        ...(excludedResultId === undefined ? {} : { excludedResultId }),
      });

      return {
        schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
        kind: 'completed',
        comparison: aggregate,
        freshness: {
          sourceReadAt,
          cacheStatus: 'live',
        },
      };
    },
  };
}

function requireBaseRequest(
  request: DailyNineComparisonBaseRequest,
  currentDailyDate: string,
): {
  puzzleId: string | undefined;
  puzzleDate: string;
  rulesetVersion: DailyNineComparisonApiRulesetVersion;
  excludedResultId: string | undefined;
} {
  if (request.rulesetVersion === null || request.rulesetVersion.trim() === '') {
    invalidRequest('ruleset is required.');
  }
  if (!isDailyNineComparisonApiRulesetVersion(request.rulesetVersion)) {
    throw new DailyNineComparisonRequestError(
      'unsupported_ruleset',
      'Daily Nine comparison ruleset is unsupported.',
    );
  }

  const puzzleId = request.puzzleId ?? undefined;
  if (puzzleId !== undefined && (puzzleId.trim().length === 0 || puzzleId.length > 200)) {
    invalidRequest('puzzleId must be a non-empty identity of at most 200 characters.');
  }
  if (isArchiveBetaDailyPuzzleId(puzzleId)
    && request.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION) {
    throw new DailyNineComparisonRequestError(
      'unsupported_ruleset',
      'Archive beta comparison ruleset is unsupported.',
    );
  }

  const excludedResultId = requireExcludedResultId(request.excludedResultId);
  const puzzleDate = readCalendarDate(request.puzzleDate);
  if (puzzleDate === null) invalidRequest('date must be a calendar date.');
  if (puzzleDate > currentDailyDate) {
    throw new DailyNineComparisonRequestError(
      'invalid_puzzle',
      'Future Daily comparison is unavailable.',
    );
  }
  return {
    puzzleId,
    puzzleDate,
    rulesetVersion: request.rulesetVersion,
    excludedResultId,
  };
}

function requireExcludedResultId(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    invalidRequest('excludeResultId must be a valid anonymous result identity.');
  }
  return value;
}

function requirePitchNumber(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) invalidRequest('pitch must be an integer.');
  const pitchNumber = Number(value);
  if (!Number.isSafeInteger(pitchNumber)
    || pitchNumber < 1
    || pitchNumber > DAILY_AT_BAT_COUNT) {
    invalidRequest(`pitch must be between 1 and ${DAILY_AT_BAT_COUNT}.`);
  }
  return pitchNumber;
}

function readCalendarDate(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return value;
}

function requireIsoTimestamp(value: Date): string {
  const timestamp = value.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error('Daily Nine comparison source-read clock is invalid.');
  }
  return value.toISOString();
}

function invalidRequest(message: string): never {
  throw new DailyNineComparisonRequestError('invalid_request', message);
}
