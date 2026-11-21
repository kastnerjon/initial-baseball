import 'server-only';
import { validateDailyAtBatResult, validateDailyCompletedResult } from '@initial-baseball/engine';
import { DAILY_AT_BAT_RESULT_SCHEMA_VERSION, DAILY_COMPLETED_RESULT_SCHEMA_VERSION, type DailyPublicPuzzle } from '@initial-baseball/shared';
import type { OfficialDailyCompetitiveProof } from './officialDailyCompetitiveProof';

/** Derive persistence rows from a verified transcript and its released puzzle. */
export function deriveOfficialDailyScorecard(
  puzzle: DailyPublicPuzzle, proof: OfficialDailyCompetitiveProof, completed: boolean,
) {
  const context = { puzzleId: proof.puzzleId, puzzleDate: proof.puzzleDate,
    puzzleNumber: puzzle.puzzleNumber, rulesetVersion: proof.rulesetVersion };
  // Validate ALL facts before the first write, including the completed summary.
  const rows = proof.atBats.map(atBat => validateDailyAtBatResult({
    puzzle, rulesetVersion: proof.rulesetVersion,
    submission: { ...context, schemaVersion: DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
      attemptId: proof.attemptId, atBat },
  }));
  const atBats = [];
  for (const row of rows) {
    if (!row.ok) return null;
    atBats.push(row.result);
  }
  const completion = completed ? validateDailyCompletedResult({
    puzzle, rulesetVersion: proof.rulesetVersion,
    submission: { ...context, schemaVersion: DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
      submissionId: `official-${proof.puzzleId}-${proof.attemptId}`,
      completedAtBats: proof.atBats },
  }) : null;
  if (completion && !completion.ok) return null;
  return { atBats, completion: completion?.result ?? null };
}
