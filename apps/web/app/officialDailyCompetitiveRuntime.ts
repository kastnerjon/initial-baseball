import 'server-only';
import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { DailyProgressionTokenCodec } from './dailyProgressionToken';
import type { DailyHintBundle, DailyRuntimeService } from './dailyRuntimeContracts';
import type { OfficialDailyAttemptReservation } from './officialDailyAttemptReservation';
import { verifyOfficialDailyCompetitiveTranscript } from './officialDailyCompetitiveTranscript';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import {
  createOfficialDailyCompetitiveProofCodec,
  type OfficialDailyCompetitiveProof,
} from './officialDailyCompetitiveProof';

/**
 * Source-only provenance producer for exact-ID Daily play. It is deliberately
 * not wired to routes or score admission. Bootstraps require a durable SQL
 * first-start reservation, but signed branches still need atomic progression
 * CAS before any score eligibility. No cookie or public transport is installed.
 */
export function createOfficialDailyCompetitiveRuntime(input: {
  puzzleId: string;
  runtime: DailyRuntimeService;
  progressionTokens: DailyProgressionTokenCodec;
  secret: string;
  now: () => Date;
  /** Server-only, SQL-backed first-start winner for the validated browser credential. */
  reserveAttempt: (request: {
    puzzleId: string; puzzleDate: string; rulesetVersion: 'points-v4';
  }) => Promise<OfficialDailyAttemptReservation>;
}): DailyRuntimeService {
  const proofs = createOfficialDailyCompetitiveProofCodec(input.secret);
  const fail = () => { throw new Error('Official Daily competitive progression unavailable.'); };

  async function verify(token: string) {
    const proof = proofs.verify(token);
    if (proof.puzzleId !== input.puzzleId) return fail();
    const puzzle = await input.runtime.getPublicPuzzle(proof.puzzleDate);
    const claims = verifyOfficialDailyCompetitiveTranscript(proof, input.progressionTokens, puzzle, input.puzzleId);
    return { proof, claims, puzzle };
  }

  function wrapBundle(bundle: DailyHintBundle, proof: OfficialDailyCompetitiveProof): DailyHintBundle {
    return { ...bundle, checkpoints: bundle.checkpoints.map(checkpoint => ({ ...checkpoint,
      progressionToken: proofs.sign({ ...proof, progressionToken: checkpoint.progressionToken }),
    })) };
  }

  return {
    getPublicPuzzle: date => input.runtime.getPublicPuzzle(date),
    async getBootstrap(date, rulesetVersion) {
      const now = input.now();
      if (!Number.isFinite(now.getTime()) || getPacificDailyDateString(now) !== date
        || (rulesetVersion !== undefined && rulesetVersion !== 'points-v4')) return fail();
      const bootstrap = await input.runtime.getBootstrap(date, 'points-v4');
      if (bootstrap.puzzle.id !== input.puzzleId || bootstrap.puzzle.puzzleDate !== date
        || bootstrap.rulesetVersion !== 'points-v4') return fail();
      if (bootstrap.puzzle.status !== 'published') return fail();
      const reservation = await input.reserveAttempt({
        puzzleId: input.puzzleId, puzzleDate: date, rulesetVersion: 'points-v4',
      });
      const startedAt = Date.parse(reservation.startedAt);
      // Read the clock again: SQL can commit after this request's pre-reservation time.
      // Tolerate bounded server/DB clock skew without accepting a future-day first start.
      const afterReservation = input.now().getTime();
      if (reservation.puzzleId !== input.puzzleId || reservation.puzzleDate !== date
        || reservation.rulesetVersion !== 'points-v4' || !Number.isFinite(startedAt)
        || !Number.isFinite(afterReservation) || startedAt > afterReservation + 60_000
        || getPacificDailyDateString(new Date(startedAt)) !== date) return fail();
      const proof: OfficialDailyCompetitiveProof = {
        version: 1, purpose: 'live', attemptId: reservation.attemptId,
        puzzleId: input.puzzleId, puzzleDate: date, rulesetVersion: 'points-v4',
        startedAt, progressionToken: bootstrap.progressionToken, atBats: [],
      };
      const token = proofs.sign(proof);
      await verify(token);
      return { ...bootstrap, progressionToken: token, hintBundle: wrapBundle(bootstrap.hintBundle, proof) };
    },
    async getHintBundle(token) {
      const { proof } = await verify(token);
      const response = await input.runtime.getHintBundle(proof.progressionToken);
      return { hintBundle: wrapBundle(response.hintBundle, proof) };
    },
    async revealHint(token) {
      const { proof } = await verify(token);
      const response = await input.runtime.revealHint(proof.progressionToken);
      return { ...response, progressionToken: proofs.sign({ ...proof, progressionToken: response.progressionToken }) };
    },
    async resolveAtBat(request) {
      const { proof, claims, puzzle } = await verify(request.progressionToken);
      if (claims.completed) return fail();
      const response = await input.runtime.resolveAtBat({ ...request, progressionToken: proof.progressionToken });
      const next = input.progressionTokens.verify(response.progressionToken);
      if (next.puzzleId !== proof.puzzleId || next.puzzleDate !== proof.puzzleDate
        || next.rulesetVersion !== proof.rulesetVersion) return fail();
      const atBats = [...proof.atBats];
      if (response.result.kind !== 'incorrect') {
        const pitch = puzzle.pitches[claims.pitchNumber - 1];
        const fact: DailyCompletedAtBat = {
          pitchNumber: claims.pitchNumber, initials: pitch?.initials ?? '',
          outcome: response.result.outcome, hintsRevealed: response.result.revealedCount,
          wrongGuesses: claims.strikeCount + (response.result.kind === 'strikeout' && !request.giveUp ? 1 : 0),
          resolution: response.result.kind === 'correct' ? 'correct' : request.giveUp ? 'give_up' : 'strikeout',
        };
        if (!normalizeDailyTerminalAtBat(fact, pitch).ok) return fail();
        atBats.push(fact);
      }
      const successor = { ...proof, progressionToken: response.progressionToken, atBats };
      const token = proofs.sign(successor);
      await verify(token);
      return { ...response, progressionToken: token,
        hintBundle: response.hintBundle ? wrapBundle(response.hintBundle, successor) : null };
    },
  };
}
