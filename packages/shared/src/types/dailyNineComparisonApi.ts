import type { POINTS_V3_DAILY_RULESET_VERSION } from './daily.js';

export const DAILY_NINE_COMPARISON_API_SCHEMA_VERSION = 1 as const;

export type DailyNineComparisonApiFreshness = {
  /** When the backing comparison snapshot was read from its source. Cached responses preserve this. */
  sourceReadAt: string;
  /** When this HTTP response payload was assembled for the caller. */
  servedAt: string;
  /** Distinguishes a direct provider read from a later shared-cache response. */
  cacheStatus: 'live' | 'cached';
};

export type DailyNineComparisonApiKey = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: typeof POINTS_V3_DAILY_RULESET_VERSION;
};

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
    /** Index is the final Daily Nine points-v3 score. */
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
