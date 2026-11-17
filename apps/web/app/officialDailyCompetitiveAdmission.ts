import 'server-only';
import { validateDailyAtBatResult, validateDailyCompletedResult } from '@initial-baseball/engine';
import {
  createDailyAtBatResultService, createDailyCompletedResultService,
  type DailyAtBatResultRepository, type DailyCompletedResultRepository,
} from '@initial-baseball/daily';
import {
  DAILY_AT_BAT_RESULT_SCHEMA_VERSION, DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import type { DailyProgressionTokenCodec } from './dailyProgressionToken';
import { createOfficialDailyCompetitiveProofCodec } from './officialDailyCompetitiveProof';
import { verifyOfficialDailyCompetitiveTranscript } from './officialDailyCompetitiveTranscript';
import { getPacificDailyDateString } from './getPacificDailyDateString';

type Admission = { ok: true; status: 'created' | 'existing'; completed: boolean }
  | { ok: false; error: 'invalid_proof' | 'idempotency_conflict' };

/**
 * Source-only consumer; no route imports this module. Repository inserts MUST
 * be atomic and immutable. Ordered prefix writes may persist on failure, so a
 * retry must carry the same signed facts. This is not a multi-row transaction,
 * first-start reservation, or prevention of gameplay-token forks (#656).
 */
export function createOfficialDailyCompetitiveAdmission(input: {
  secret: string;
  progressionTokens: DailyProgressionTokenCodec;
  /** Must resolve immutable, released publication content by exact ID. */
  loadReleasedPuzzle: (puzzleId: string) => Promise<DailyPublicPuzzle>;
  atBats: DailyAtBatResultRepository;
  completions: DailyCompletedResultRepository;
  now: () => Date;
  /** Trusted explicit policy; no production default or activation implied. */
  maximumAttemptAgeMs: number;
}) {
  if (!Number.isSafeInteger(input.maximumAttemptAgeMs) || input.maximumAttemptAgeMs <= 0) {
    throw new Error('A bounded competitive retry policy is required.');
  }
  const proofs = createOfficialDailyCompetitiveProofCodec(input.secret);
  const atBats = createDailyAtBatResultService(input.atBats);
  const completions = createDailyCompletedResultService(input.completions);
  return {
    async submit(token: string, expectedPuzzleId: string): Promise<Admission> {
      const invalid = { ok: false, error: 'invalid_proof' } as const;
      // Authentication failures are sanitized; provider failures propagate for retry.
      let proof;
      try { proof = proofs.verify(token); } catch { return invalid; }
      const now = input.now().getTime();
      if (proof.puzzleId !== expectedPuzzleId || !Number.isFinite(now)
        || proof.startedAt > now || now - proof.startedAt > input.maximumAttemptAgeMs
        || getPacificDailyDateString(new Date(proof.startedAt)) !== proof.puzzleDate
        || proof.atBats.length === 0) return invalid;
      const puzzle = await input.loadReleasedPuzzle(proof.puzzleId);
      let verified;
      try {
        verified = verifyOfficialDailyCompetitiveTranscript(
          proof, input.progressionTokens, puzzle, expectedPuzzleId,
        );
      } catch { return invalid; }
      const context = { puzzleId: proof.puzzleId, puzzleDate: proof.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber, rulesetVersion: proof.rulesetVersion };
      // Validate ALL facts before the first write, including the completed summary.
      const rows = proof.atBats.map(atBat => validateDailyAtBatResult({
        puzzle, rulesetVersion: proof.rulesetVersion,
        submission: { ...context, schemaVersion: DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
          attemptId: proof.attemptId, atBat },
      }));
      if (rows.some(row => !row.ok)) return invalid;
      const completion = verified.completed ? validateDailyCompletedResult({
        puzzle, rulesetVersion: proof.rulesetVersion,
        submission: { ...context, schemaVersion: DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
          submissionId: `official-${proof.puzzleId}-${proof.attemptId}`,
          completedAtBats: proof.atBats },
      }) : null;
      if (completion && !completion.ok) return invalid;
      let created = false;
      for (const row of rows) {
        if (!row.ok) return invalid;
        const result = await atBats.store(row.result);
        if (!result.ok) return { ok: false, error: result.error };
        created ||= result.status === 'created';
      }
      if (completion?.ok) {
        const result = await completions.store(completion.result);
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, status: result.status, completed: true };
      }
      return { ok: true, status: created ? 'created' : 'existing', completed: false };
    },
  };
}
