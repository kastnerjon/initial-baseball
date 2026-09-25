import type {
  DailyCompletedAtBat,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
} from './daily.js';

export const DAILY_AT_BAT_RESULT_SCHEMA_VERSION = 1 as const;

export type DailyAtBatResultRulesetVersion =
  | typeof POINTS_V3_DAILY_RULESET_VERSION
  | typeof POINTS_V4_DAILY_RULESET_VERSION;

/** One terminal observation; neither a score claim nor a complete-game claim. */
export type DailyAtBatResultSubmission = {
  schemaVersion: typeof DAILY_AT_BAT_RESULT_SCHEMA_VERSION;
  attemptId: string;
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: DailyAtBatResultRulesetVersion;
  atBat: DailyCompletedAtBat;
};

/** Whitelisted native facts with engine-derived points; no receipt time yet. */
export type DailyAtBatResult = DailyAtBatResultSubmission & { awardedPoints: number };

export type DailyAtBatResultError =
  | 'invalid_submission'
  | 'unsupported_schema'
  | 'invalid_attempt_id'
  | 'unsupported_ruleset'
  | 'ruleset_mismatch'
  | 'invalid_puzzle'
  | 'puzzle_mismatch'
  | 'invalid_at_bat'
  | 'at_bat_mismatch'
  | 'inconsistent_at_bat';

export type DailyAtBatResultValidation =
  | { ok: true; result: DailyAtBatResult }
  | { ok: false; error: DailyAtBatResultError };
