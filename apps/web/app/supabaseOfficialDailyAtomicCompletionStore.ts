import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import type { OfficialDailyAttemptReservation } from './officialDailyAttemptReservation';
import { encodeDailyAtBatResultRow } from './supabaseDailyAtBatResultRowCodec';
import { encodeDailyCompletedResultRow } from './supabaseDailyCompletedResultRowCodec';

/**
 * Private SQL transaction adapter, deliberately disconnected from public routes.
 * The caller MUST first verify the signed canonical completed progression,
 * released exact edition, engine-derived nine slot points and summary.
 * This store does not independently authenticate tokens or compute scores.
 */
export function createSupabaseOfficialDailyAtomicCompletionStore(client: SupabaseClient) {
  return {
    async advanceAndCommit(input: {
      reservation: OfficialDailyAttemptReservation;
      expectedToken: string;
      nextToken: string;
      terminalAtBats: DailyCompletedResult['completedAtBats'];
      atBats: DailyAtBatResult[];
      completion: DailyCompletedResult;
    }): Promise<'created' | 'existing'> {
      const { reservation, expectedToken, nextToken, terminalAtBats, atBats, completion } = input;
      if (expectedToken === nextToken ||
        !expectedToken.startsWith('official-daily-competitive-proof-v1.') ||
        !nextToken.startsWith('official-daily-competitive-proof-v1.') ||
        terminalAtBats.length !== 9 || completion.completedAtBats.length !== 9 ||
        terminalAtBats.some((fact, index) => {
          const expected = completion.completedAtBats[index];
          return !expected || fact.pitchNumber !== index + 1 || fact.pitchNumber !== expected.pitchNumber ||
            fact.initials !== expected.initials || fact.outcome !== expected.outcome ||
            fact.hintsRevealed !== expected.hintsRevealed ||
            fact.wrongGuesses !== expected.wrongGuesses ||
            fact.resolution !== expected.resolution;
        })) throw new Error('Invalid private official Daily final transition.');
      // Validate the same envelope as the standalone writer before calling SQL.
      // The service caller must verify both signed tokens and engine-derived points.
      const submissionId = `official-${reservation.puzzleId}-${reservation.attemptId}`;
      if (reservation.rulesetVersion !== 'points-v4' ||
        !/^[0-9a-f]{64}$/.test(reservation.browserKeyDigest) ||
        completion.submissionId !== submissionId ||
        completion.puzzleId !== reservation.puzzleId ||
        completion.puzzleDate !== reservation.puzzleDate ||
        completion.rulesetVersion !== reservation.rulesetVersion ||
        atBats.length !== 9 ||
        atBats.some((row, index) => {
          const fact = terminalAtBats[index];
          return row.attemptId !== reservation.attemptId ||
            row.puzzleId !== reservation.puzzleId ||
            row.puzzleDate !== reservation.puzzleDate ||
            row.rulesetVersion !== reservation.rulesetVersion ||
            row.puzzleNumber !== completion.puzzleNumber ||
            !fact || row.atBat.pitchNumber !== fact.pitchNumber ||
            row.atBat.initials !== fact.initials ||
            row.atBat.outcome !== fact.outcome ||
            row.atBat.hintsRevealed !== fact.hintsRevealed ||
            row.atBat.wrongGuesses !== fact.wrongGuesses ||
            row.atBat.resolution !== fact.resolution;
        })) throw new Error('Invalid private official Daily final transition.');
      let response;
      try {
        response = await client.rpc('advance_and_commit_official_daily_completed_results', {
          p_puzzle_id: reservation.puzzleId,
          p_browser_key_digest: reservation.browserKeyDigest,
          p_attempt_id: reservation.attemptId,
          p_expected_token: expectedToken,
          p_next_token: nextToken,
          p_terminal_at_bats: terminalAtBats,
          p_at_bat_rows: atBats.map(encodeDailyAtBatResultRow),
          p_completion_row: encodeDailyCompletedResultRow(completion),
        });
      } catch {
        throw new Error('Private official Daily final transition unavailable.');
      }
      if (response.error !== null || (response.data !== 'created' && response.data !== 'existing')) {
        throw new Error('Private official Daily final transition unavailable.');
      }
      return response.data;
    },

    async commit(input: {
      reservation: OfficialDailyAttemptReservation;
      canonicalToken: string;
      atBats: DailyAtBatResult[];
      completion: DailyCompletedResult;
    }): Promise<'created' | 'existing'> {
      const { reservation, atBats, completion, canonicalToken } = input;
      const submissionId = `official-${reservation.puzzleId}-${reservation.attemptId}`;
      if (reservation.rulesetVersion !== 'points-v4' ||
        !/^[0-9a-f]{64}$/.test(reservation.browserKeyDigest) ||
        !canonicalToken.startsWith('official-daily-competitive-proof-v1.') ||
        atBats.length !== 9 ||
        completion.submissionId !== submissionId ||
        completion.puzzleId !== reservation.puzzleId ||
        completion.puzzleDate !== reservation.puzzleDate ||
        completion.rulesetVersion !== reservation.rulesetVersion ||
        completion.completedAtBats.length !== 9 ||
        atBats.some((row, index) =>
          row.attemptId !== reservation.attemptId ||
          row.puzzleId !== reservation.puzzleId ||
          row.puzzleDate !== reservation.puzzleDate ||
          row.rulesetVersion !== reservation.rulesetVersion ||
          row.puzzleNumber !== completion.puzzleNumber ||
          row.atBat.pitchNumber !== index + 1 ||
          (() => {
            const expected = completion.completedAtBats[index];
            return !expected || row.atBat.pitchNumber !== expected.pitchNumber ||
              row.atBat.initials !== expected.initials ||
              row.atBat.outcome !== expected.outcome ||
              row.atBat.hintsRevealed !== expected.hintsRevealed ||
              row.atBat.wrongGuesses !== expected.wrongGuesses ||
              row.atBat.resolution !== expected.resolution;
          })())
      ) {
        throw new Error('Invalid private official Daily completion input.');
      }
      let response;
      try {
        response = await client.rpc('commit_official_daily_completed_results', {
          p_puzzle_id: reservation.puzzleId,
          p_browser_key_digest: reservation.browserKeyDigest,
          p_attempt_id: reservation.attemptId,
          p_expected_token: canonicalToken,
          p_at_bat_rows: atBats.map(encodeDailyAtBatResultRow),
          p_completion_row: encodeDailyCompletedResultRow(completion),
        });
      } catch {
        throw new Error('Private official Daily completion unavailable.');
      }
      if (response.error !== null || (response.data !== 'created' && response.data !== 'existing')) {
        throw new Error('Private official Daily completion unavailable.');
      }
      return response.data;
    },
  };
}
