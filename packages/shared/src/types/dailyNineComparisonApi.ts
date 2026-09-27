import {
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from './daily.js';

export const DAILY_NINE_COMPARISON_API_SCHEMA_VERSION = 1 as const;

export type DailyNineComparisonApiFreshness = {
  /** When the backing comparison snapshot was read from its source. Cached responses preserve this. */
  sourceReadAt: string;
  /** Distinguishes a direct provider read from a later shared-cache response. */
  cacheStatus: 'live' | 'cached';
};

export type DailyNineComparisonApiRulesetVersion =
  | typeof POINTS_V3_DAILY_RULESET_VERSION
  | typeof POINTS_V4_DAILY_RULESET_VERSION;

export type DailyNineComparisonApiKey = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: DailyNineComparisonApiRulesetVersion;
};

export function isDailyNineComparisonApiRulesetVersion(
  value: unknown,
): value is DailyNineComparisonApiRulesetVersion {
  return value === POINTS_V3_DAILY_RULESET_VERSION
    || value === POINTS_V4_DAILY_RULESET_VERSION;
}

export type DailyNineAtBatComparisonApiResponse = {
  schemaVersion: typeof DAILY_NINE_COMPARISON_API_SCHEMA_VERSION;
  kind: 'at-bat';
  comparison: DailyNineComparisonApiKey & {
    pitchNumber: number;
    resolvedAtBatCount: number;
    averagePoints: number | null;
  };
  freshness: DailyNineComparisonApiFreshness;
};

export type DailyNineCompletedComparisonApiResponse = {
  schemaVersion: typeof DAILY_NINE_COMPARISON_API_SCHEMA_VERSION;
  kind: 'completed';
  comparison: DailyNineComparisonApiKey & {
    completedGameCount: number;
    averageTotalPoints: number | null;
    /** Offset histogram interpreted by the exact ruleset's minimum and score step. */
    scoreHistogram: number[];
  };
  freshness: DailyNineComparisonApiFreshness;
};

export type DailyNineComparisonApiSuccess =
  | DailyNineAtBatComparisonApiResponse
  | DailyNineCompletedComparisonApiResponse;

export type DailyNineComparisonApiErrorCode =
  | 'invalid_request'
  | 'invalid_puzzle'
  | 'unsupported_ruleset'
  | 'comparison_unavailable';

export type DailyNineComparisonApiErrorResponse = {
  schemaVersion: typeof DAILY_NINE_COMPARISON_API_SCHEMA_VERSION;
  error: DailyNineComparisonApiErrorCode;
};
