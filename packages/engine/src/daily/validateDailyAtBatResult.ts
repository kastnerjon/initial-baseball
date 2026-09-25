import {
  DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyAtBatResultError,
  type DailyAtBatResultValidation,
  type DailyPublicPuzzle,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { getDailyAtBatPoints } from './applyDailyRuleset.js';
import { normalizeDailyTerminalAtBat } from './normalizeDailyTerminalAtBat.js';

export type ValidateDailyAtBatResultInput = {
  submission: unknown;
  /** Authoritative caller context, never the submitted puzzle or ruleset. */
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber' | 'pitches'>;
  rulesetVersion: DailyRulesetVersion;
};

/** Internal consistency only: no claim of honest play or earlier AB delivery. */
export function validateDailyAtBatResult({
  submission, puzzle, rulesetVersion,
}: ValidateDailyAtBatResultInput): DailyAtBatResultValidation {
  if (!isRecord(submission)) return reject('invalid_submission');
  if (submission.schemaVersion !== DAILY_AT_BAT_RESULT_SCHEMA_VERSION) return reject('unsupported_schema');
  if (typeof submission.attemptId !== 'string'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(submission.attemptId)) return reject('invalid_attempt_id');
  if (submission.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    && submission.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION) return reject('unsupported_ruleset');
  if (submission.rulesetVersion !== rulesetVersion) return reject('ruleset_mismatch');
  if (puzzle.pitches.length !== 9 || puzzle.pitches.some((pitch, index) =>
    pitch.pitchNumber !== index + 1 || !pitch.initials.trim())) return reject('invalid_puzzle');
  if (submission.puzzleId !== puzzle.id || submission.puzzleDate !== puzzle.puzzleDate
    || submission.puzzleNumber !== puzzle.puzzleNumber) return reject('puzzle_mismatch');

  const fact = submission.atBat;
  const pitch = isRecord(fact) ? puzzle.pitches.find(candidate => candidate.pitchNumber === fact.pitchNumber) : undefined;
  const normalized = normalizeDailyTerminalAtBat(fact, pitch);
  if (!normalized.ok) return reject(normalized.error);
  return {
    ok: true,
    result: {
      schemaVersion: DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
      attemptId: submission.attemptId,
      puzzleId: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion: submission.rulesetVersion,
      atBat: normalized.atBat,
      awardedPoints: getDailyAtBatPoints({ ...normalized.atBat, rulesetVersion: submission.rulesetVersion }),
    },
  };
}

function reject(error: DailyAtBatResultError): DailyAtBatResultValidation {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
