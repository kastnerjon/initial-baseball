import {
  DAILY_AT_BAT_COUNT,
  type DailyNineComparisonService,
} from '@initial-baseball/daily';
import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyNineAtBatComparisonApiResponse,
  type DailyNineCompletedComparisonApiResponse,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';

export type DailyNineComparisonRequestErrorCode =
  | 'invalid_request'
  | 'invalid_puzzle'
  | 'unsupported_ruleset';

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
  puzzleDate: string | null;
  rulesetVersion: string | null;
};

export type DailyNineAtBatComparisonReadRequest = DailyNineComparisonBaseRequest & {
  pitchNumber: string | null;
};

export type DailyNineCompletedComparisonReadRequest = DailyNineComparisonBaseRequest;

type CreateDailyNineComparisonReadServiceInput = {
  comparison: DailyNineComparisonService;
  loadAuthoritativePuzzle: (puzzleDate: string) => Promise<DailyPublicPuzzle>;
  getCurrentDailyDate: () => string;
  now?: () => Date;
};

export function createDailyNineComparisonReadService({
  comparison,
  loadAuthoritativePuzzle,
  getCurrentDailyDate,
  now = () => new Date(),
}: CreateDailyNineComparisonReadServiceInput) {
  async function loadComparisonPuzzle(puzzleDate: string): Promise<DailyPublicPuzzle> {
    const puzzle = await loadAuthoritativePuzzle(puzzleDate);
    if (puzzle.puzzleDate !== puzzleDate) {
      throw new DailyNineComparisonRequestError(
        'invalid_puzzle',
        'Authoritative Daily puzzle does not match requested date.',
      );
    }
    return puzzle;
  }

  return {
    async readAtBat(
      request: DailyNineAtBatComparisonReadRequest,
    ): Promise<DailyNineAtBatComparisonApiResponse> {
      const puzzleDate = requireBaseRequest(request, getCurrentDailyDate());
      const pitchNumber = requirePitchNumber(request.pitchNumber);
      const puzzle = await loadComparisonPuzzle(puzzleDate);
      const aggregate = await comparison.getAtBat({
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
        pitchNumber,
      });

      return {
        schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
        kind: 'at-bat',
        comparison: aggregate,
        freshness: {
          sourceReadAt: requireIsoTimestamp(now()),
          cacheStatus: 'live',
        },
      };
    },

    async readCompleted(
      request: DailyNineCompletedComparisonReadRequest,
    ): Promise<DailyNineCompletedComparisonApiResponse> {
      const puzzleDate = requireBaseRequest(request, getCurrentDailyDate());
      const puzzle = await loadComparisonPuzzle(puzzleDate);
      const aggregate = await comparison.getCompletedGames({
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      });

      return {
        schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
        kind: 'completed',
        comparison: aggregate,
        freshness: {
          sourceReadAt: requireIsoTimestamp(now()),
          cacheStatus: 'live',
        },
      };
    },
  };
}

function requireBaseRequest(
  request: DailyNineComparisonBaseRequest,
  currentDailyDate: string,
): string {
  if (request.rulesetVersion === null || request.rulesetVersion.trim() === '') {
    invalidRequest('ruleset is required.');
  }
  if (request.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION) {
    throw new DailyNineComparisonRequestError(
      'unsupported_ruleset',
      'Only points-v3 Daily Nine comparison is supported.',
    );
  }

  const puzzleDate = readCalendarDate(request.puzzleDate);
  if (puzzleDate === null) invalidRequest('date must be a calendar date.');
  if (puzzleDate > currentDailyDate) {
    throw new DailyNineComparisonRequestError(
      'invalid_puzzle',
      'Future Daily comparison is unavailable.',
    );
  }
  return puzzleDate;
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
