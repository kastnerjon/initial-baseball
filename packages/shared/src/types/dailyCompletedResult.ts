import type {
  CLASSIC_DAILY_RULESET_VERSION,
  DailyCompletedAtBat,
  DailyPointsSummary,
  DailyScoreSummary,
  POINTS_V3_DAILY_RULESET_VERSION,
} from './daily.js';

export const DAILY_COMPLETED_RESULT_SCHEMA_VERSION = 1 as const;

/** The ruleset also identifies the game; compatibility saves are not submissions. */
export type DailyCompletedResultRulesetVersion =
  | typeof POINTS_V3_DAILY_RULESET_VERSION
  | typeof CLASSIC_DAILY_RULESET_VERSION;

/** Native facts only. Scores and receipt timestamps are not client authority. */
export type DailyCompletedResultSubmission = {
  schemaVersion: typeof DAILY_COMPLETED_RESULT_SCHEMA_VERSION;
  submissionId: string;
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: DailyCompletedResultRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};

/** Normalized facts plus the engine-derived summary for exactly one game. */
export type DailyCompletedResult = DailyCompletedResultSubmission & (
  | {
      rulesetVersion: typeof POINTS_V3_DAILY_RULESET_VERSION;
      summary: DailyPointsSummary & { strikeouts: number };
    }
  | {
      rulesetVersion: typeof CLASSIC_DAILY_RULESET_VERSION;
      summary: DailyScoreSummary & { atBatsCompleted: number; totalAtBats: number };
    }
);

export type DailyCompletedResultError =
  | 'invalid_submission'
  | 'unsupported_schema'
  | 'invalid_submission_id'
  | 'unsupported_ruleset'
  | 'ruleset_mismatch'
  | 'invalid_puzzle'
  | 'puzzle_mismatch'
  | 'invalid_at_bat'
  | 'at_bat_mismatch'
  | 'inconsistent_at_bat'
  | 'incomplete_game'
  | 'after_completion';

export type DailyCompletedResultValidation =
  | { ok: true; result: DailyCompletedResult }
  | { ok: false; error: DailyCompletedResultError };
