import { validateCustomNinePuzzleId } from '@initial-baseball/daily';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { decodeDailyAtBatResultRow, encodeDailyAtBatResultRow } from './supabaseDailyAtBatResultRowCodec';
import { decodeDailyCompletedResultRow, encodeDailyCompletedResultRow } from './supabaseDailyCompletedResultRowCodec';

const CUSTOM_RULESET = 'points-v4' as const;
const CUSTOM_PUZZLE_NUMBER = 1;

export class SupabaseCustomNineResultError extends Error {
  constructor(public readonly kind: 'invalid-row' | 'query', message: string) {
    super(message);
    this.name = 'SupabaseCustomNineResultError';
  }
}

/**
 * Map an engine-normalized Daily points-v4 result onto the permanent Custom
 * population without storing a made-up calendar date or a Daily puzzle number.
 * This is a private provider boundary, NOT authorization to insert submissions.
 */
export function encodeCustomNineCompletedRow(result: DailyCompletedResult) {
  try {
    requireScope(result);
    requireComplete(result);
    const normalized = decodeDailyCompletedResultRow(encodeDailyCompletedResultRow(result));
    requireComplete(normalized);
    const row = encodeDailyCompletedResultRow(normalized);
    return {
      submission_id: row.submission_id,
      challenge_id: result.puzzleId,
      schema_version: row.schema_version,
      ruleset_version: row.ruleset_version,
      completed_at_bats: row.completed_at_bats,
      summary: row.summary,
    };
  } catch {
    return invalid('Invalid Custom Nine completed result.');
  }
}

export function decodeCustomNineCompletedRow(raw: unknown): DailyCompletedResult {
  const row = record(raw);
  const challengeId = requireChallengeId(row.challenge_id);
  requireRuleset(row.ruleset_version);
  try {
    const result = decodeDailyCompletedResultRow({
      ...row,
      puzzle_id: challengeId,
      puzzle_date: CUSTOM_NINE_SESSION_DATE,
      puzzle_number: CUSTOM_PUZZLE_NUMBER,
    });
    requireComplete(result);
    return result;
  } catch (error) {
    return invalid('Invalid Custom Nine completed result row.', error);
  }
}

export function encodeCustomNineAtBatRow(result: DailyAtBatResult) {
  requireScope(result);
  let row;
  try {
    row = encodeDailyAtBatResultRow(
      decodeDailyAtBatResultRow(encodeDailyAtBatResultRow(result)),
    );
  } catch (error) {
    return invalid('Invalid Custom Nine at-bat observation.', error);
  }
  return {
    attempt_id: row.attempt_id,
    challenge_id: result.puzzleId,
    schema_version: row.schema_version,
    ruleset_version: row.ruleset_version,
    pitch_number: row.pitch_number,
    initials: row.initials,
    outcome: row.outcome,
    hints_revealed: row.hints_revealed,
    wrong_guesses: row.wrong_guesses,
    resolution: row.resolution,
    awarded_points: row.awarded_points,
  };
}

export function decodeCustomNineAtBatRow(raw: unknown): DailyAtBatResult {
  const row = record(raw);
  const challengeId = requireChallengeId(row.challenge_id);
  requireRuleset(row.ruleset_version);
  try {
    return decodeDailyAtBatResultRow({
      ...row,
      puzzle_id: challengeId,
      puzzle_date: CUSTOM_NINE_SESSION_DATE,
      puzzle_number: CUSTOM_PUZZLE_NUMBER,
    });
  } catch (error) {
    return invalid('Invalid Custom Nine at-bat result row.', error);
  }
}

function requireScope(value: {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: string;
}): void {
  requireChallengeId(value.puzzleId);
  requireRuleset(value.rulesetVersion);
  if (value.puzzleDate !== CUSTOM_NINE_SESSION_DATE || value.puzzleNumber !== CUSTOM_PUZZLE_NUMBER) {
    invalid('Custom Nine session identity mismatch.');
  }
}

function requireComplete(value: DailyCompletedResult): void {
  if (value.rulesetVersion !== CUSTOM_RULESET
    || value.completedAtBats.length !== 9
    || !value.summary.completed
    || value.summary.atBatsCompleted !== 9
    || value.completedAtBats.some((atBat, index) => atBat.pitchNumber !== index + 1)) {
    invalid('Custom Nine requires a complete ordered nine-batter points-v4 result.');
  }
}

function requireChallengeId(value: unknown): string {
  try {
    validateCustomNinePuzzleId(value as string);
    return value as string;
  } catch {
    return invalid('Invalid Custom Nine challenge identity.');
  }
}

function requireRuleset(value: unknown): void {
  if (value !== CUSTOM_RULESET) invalid('Invalid Custom Nine ruleset.');
}

function record(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return invalid('Invalid Custom Nine database row.');
  }
  return raw as Record<string, unknown>;
}

function invalid(message: string, _cause?: unknown): never {
  throw new SupabaseCustomNineResultError('invalid-row', message);
}
