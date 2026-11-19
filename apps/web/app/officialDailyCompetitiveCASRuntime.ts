import 'server-only';
import type { createSupabaseOfficialDailyAtomicCompletionStore } from './supabaseOfficialDailyAtomicCompletionStore';
import { deriveOfficialDailyScorecard } from './deriveOfficialDailyScorecard';
import type { DailyCompletedAtBat, DailyPublicPuzzle } from '@initial-baseball/shared';
import type { DailyProgressionClaims, DailyProgressionTokenCodec } from './dailyProgressionToken';
import type { DailyRuntimeService } from './dailyRuntimeContracts';
import type { OfficialDailyAttemptReservation } from './officialDailyAttemptReservation';
import type { OfficialDailyProgressionOutcome, OfficialDailyProgressionSnapshot } from './supabaseOfficialDailyProgressionStore';
import { createOfficialDailyCompetitiveProofCodec, type OfficialDailyCompetitiveProof } from './officialDailyCompetitiveProof';
import { verifyOfficialDailyCompetitiveTranscript } from './officialDailyCompetitiveTranscript';
import { getPacificDailyDateString } from './getPacificDailyDateString';

type ProgressionStore = {
  initialize: (reservation: OfficialDailyAttemptReservation, initialToken: string) =>
    Promise<OfficialDailyProgressionOutcome>;
  read: (reservation: OfficialDailyAttemptReservation) => Promise<OfficialDailyProgressionSnapshot>;
  advance: (input: {
    reservation: OfficialDailyAttemptReservation; expectedToken: string; nextToken: string;
    terminalAtBats: DailyCompletedAtBat[]; completed: boolean;
  }) => Promise<OfficialDailyProgressionOutcome>;
};

function sameFacts(a: DailyCompletedAtBat[], b: DailyCompletedAtBat[]): boolean {
  return a.length === b.length && a.every((x, i) => {
    const y = b[i];
    return y !== undefined && x.pitchNumber === y.pitchNumber && x.initials === y.initials &&
      x.outcome === y.outcome && x.hintsRevealed === y.hintsRevealed &&
      x.wrongGuesses === y.wrongGuesses && x.resolution === y.resolution;
  });
}

function sameOwner(a: OfficialDailyCompetitiveProof, b: OfficialDailyCompetitiveProof): boolean {
  return a.attemptId === b.attemptId && a.puzzleId === b.puzzleId &&
    a.puzzleDate === b.puzzleDate && a.rulesetVersion === b.rulesetVersion &&
    a.startedAt === b.startedAt;
}

function sameStageExceptLocalHint(
  saved: OfficialDailyCompetitiveProof, incoming: OfficialDailyCompetitiveProof,
  savedClaims: DailyProgressionClaims, incomingClaims: DailyProgressionClaims,
): boolean {
  return sameOwner(saved, incoming) && sameFacts(saved.atBats, incoming.atBats) &&
    !savedClaims.completed && !incomingClaims.completed &&
    savedClaims.pitchNumber === incomingClaims.pitchNumber &&
    savedClaims.strikeCount === incomingClaims.strikeCount &&
    savedClaims.outCount === incomingClaims.outCount &&
    incomingClaims.revealCount >= savedClaims.revealCount;
}

/**
 * Server-only source composition. The signed gameplay producer and SQL-backed
 * attempt reservation already exist; their caller MUST inject the same trusted,
 * server-held browser-credential reservation function. No public route uses
 * this coordinator, so no secondary competition is activated.
 *
 * Local current-batter hint checkpoints may advance revealCount without an
 * HTTP request. Scoring actions are serialized through SQL CAS; stale branches
 * cannot overwrite the winner, while a repeated identical action is recoverable
 * after a lost response. The final action commits its scorecard in the same transaction.
 */
export function createOfficialDailyCompetitiveCASRuntime(input: {
  puzzleId: string;
  runtime: DailyRuntimeService;
  progressionTokens: DailyProgressionTokenCodec;
  secret: string;
  reserveAttempt: (request: {
    puzzleId: string; puzzleDate: string; rulesetVersion: 'points-v4';
  }) => Promise<OfficialDailyAttemptReservation>;
  progression: ProgressionStore;
  completion: Pick<ReturnType<typeof createSupabaseOfficialDailyAtomicCompletionStore>, 'advanceAndCommit'>;
  now: () => Date;
  maximumAttemptAgeMs: number;
}) {
  if (!Number.isSafeInteger(input.maximumAttemptAgeMs) || input.maximumAttemptAgeMs <= 0) {
    throw new Error('A bounded official Daily progression retry policy is required.');
  }
  const proofs = createOfficialDailyCompetitiveProofCodec(input.secret);
  const fail = (): never => { throw new Error('Official Daily competitive progression unavailable.'); };

  function requireProof(token: string): OfficialDailyCompetitiveProof {
    try { return proofs.verify(token); } catch { return fail(); }
  }

  async function authorize(token: string) {
    const proof = requireProof(token);
    if (proof.puzzleId !== input.puzzleId) return fail();
    const now = input.now().getTime();
    if (!Number.isFinite(now) || proof.startedAt > now + 60_000 ||
      now - proof.startedAt > input.maximumAttemptAgeMs ||
      getPacificDailyDateString(new Date(proof.startedAt)) !== proof.puzzleDate) return fail();
    let reservation: OfficialDailyAttemptReservation;
    try {
      reservation = await input.reserveAttempt({
        puzzleId: proof.puzzleId, puzzleDate: proof.puzzleDate,
        rulesetVersion: 'points-v4',
      });
    } catch { return fail(); }
    if (reservation.puzzleId !== proof.puzzleId ||
      reservation.puzzleDate !== proof.puzzleDate ||
      reservation.rulesetVersion !== proof.rulesetVersion ||
      reservation.attemptId !== proof.attemptId ||
      Date.parse(reservation.startedAt) !== proof.startedAt ||
      !/^[0-9a-f]{64}$/.test(reservation.browserKeyDigest)) return fail();
    let puzzle: DailyPublicPuzzle;
    let claims: DailyProgressionClaims;
    try {
      puzzle = await input.runtime.getPublicPuzzle(proof.puzzleDate);
      claims = verifyOfficialDailyCompetitiveTranscript(
        proof, input.progressionTokens, puzzle, input.puzzleId,
      );
    } catch { return fail(); }
    return { reservation, puzzle, claims, proof };
  }

  function requireStored(
    state: OfficialDailyProgressionSnapshot,
    reservation: OfficialDailyAttemptReservation,
    puzzle: DailyPublicPuzzle,
  ) {
    const proof = requireProof(state.token);
    if (proof.puzzleId !== reservation.puzzleId ||
      proof.puzzleDate !== reservation.puzzleDate ||
      proof.rulesetVersion !== reservation.rulesetVersion ||
      proof.attemptId !== reservation.attemptId ||
      proof.startedAt !== Date.parse(reservation.startedAt) ||
      !sameFacts(proof.atBats, state.terminalAtBats)) return fail();
    let claims: DailyProgressionClaims;
    try {
      claims = verifyOfficialDailyCompetitiveTranscript(
        proof, input.progressionTokens, puzzle, input.puzzleId,
      );
    } catch { return fail(); }
    if ((state.status === 'completed') !== claims.completed) return fail();
    return { proof, claims };
  }

  async function current(token: string) {
    const auth = await authorize(token);
    let state: OfficialDailyProgressionSnapshot;
    try { state = await input.progression.read(auth.reservation); }
    catch { return fail(); }
    const saved = requireStored(state, auth.reservation, auth.puzzle);
    return { ...auth, state, saved };
  }

  async function readScorecard(reservation: OfficialDailyAttemptReservation) {
    const state = await input.progression.read(reservation);
    const auth = await authorize(state.token);
    if (auth.reservation.attemptId !== reservation.attemptId ||
        auth.reservation.browserKeyDigest !== reservation.browserKeyDigest) return fail();
    const { proof, claims } = requireStored(state, reservation, auth.puzzle);
    const scorecard = deriveOfficialDailyScorecard(auth.puzzle, proof, claims.completed);
    if (!scorecard) return fail();
    const common = {
      puzzle: auth.puzzle, rulesetVersion: proof.rulesetVersion,
      revision: state.revision, atBats: scorecard.atBats.map(row => row.atBat),
    };
    if (claims.completed) {
      if (!scorecard.completion) return fail();
      return { ...common, status: 'completed' as const, summary: scorecard.completion.summary };
    }
    const { hintBundle } = await input.runtime.getHintBundle(state.token);
    return { ...common, status: 'active' as const, progressionToken: state.token,
      strikeCount: claims.strikeCount, hintBundle };
  }

  const runtime: DailyRuntimeService = {
    getPublicPuzzle: date => input.runtime.getPublicPuzzle(date),

    async getBootstrap(date, rulesetVersion) {
      // The underlying source producer validates the released date and
      // reserves this exact edition before issuing its signed first token.
      const bootstrap = await input.runtime.getBootstrap(date, rulesetVersion);
      const auth = await authorize(bootstrap.progressionToken);
      let result;
      try {
        result = await input.progression.initialize(auth.reservation, bootstrap.progressionToken);
      } catch { return fail(); }
      const saved = requireStored(result.state, auth.reservation, auth.puzzle);
      if (result.outcome !== 'initialized' && result.outcome !== 'existing') return fail();
      if (result.state.status === 'completed') return fail();
      if (result.state.token === bootstrap.progressionToken) return bootstrap;
      // A lost bootstrap response or reload must resume the canonical winner,
      // not mint a second branch with the original beginning-of-game token.
      const hintBundle = await input.runtime.getHintBundle(result.state.token);
      if (saved.claims.completed) return fail();
      return { ...bootstrap, progressionToken: result.state.token, hintBundle: hintBundle.hintBundle };
    },

    async getHintBundle(token) {
      const v = await current(token);
      if (!sameStageExceptLocalHint(v.saved.proof, v.proof, v.saved.claims, v.claims)) return fail();
      return input.runtime.getHintBundle(token);
    },

    async revealHint(token) {
      const v = await current(token);
      if (!sameStageExceptLocalHint(v.saved.proof, v.proof, v.saved.claims, v.claims)) return fail();
      return input.runtime.revealHint(token);
    },

    async resolveAtBat(request) {
      const v = await current(request.progressionToken);
      // Compute a trusted deterministic successor from the signed claim and
      // exact released puzzle; never trust a client-authored score or result.
      const response = await input.runtime.resolveAtBat(request);
      const nextProof = requireProof(response.progressionToken);
      const nextClaims = verifyOfficialDailyCompetitiveTranscript(nextProof, input.progressionTokens, v.puzzle, input.puzzleId);
      if (!sameOwner(v.proof, nextProof)) return fail();
      const currentBranch = sameStageExceptLocalHint(v.saved.proof, v.proof, v.saved.claims, v.claims);
      const responseLossRetry = !currentBranch &&
        v.state.token === response.progressionToken &&
        sameFacts(v.state.terminalAtBats, nextProof.atBats);
      if (!currentBranch && !responseLossRetry) return fail();
      const expectedToken = currentBranch ? v.state.token : request.progressionToken;
      if (nextClaims.completed) {
        const scorecard = deriveOfficialDailyScorecard(v.puzzle, nextProof, true);
        if (!scorecard?.completion) return fail();
        try {
          await input.completion.advanceAndCommit({
            reservation: v.reservation, expectedToken, nextToken: response.progressionToken,
            terminalAtBats: nextProof.atBats, atBats: scorecard.atBats, completion: scorecard.completion,
          });
        } catch { return fail(); }
        return response;
      }
      let applied;
      try {
        applied = await input.progression.advance({
          reservation: v.reservation,
          expectedToken,
          nextToken: response.progressionToken,
          terminalAtBats: nextProof.atBats,
          completed: nextClaims.completed,
        });
      } catch { return fail(); }
      if ((applied.outcome !== 'advanced' && applied.outcome !== 'existing') ||
        applied.state.token !== response.progressionToken ||
        !sameFacts(applied.state.terminalAtBats, nextProof.atBats) ||
        (applied.state.status === 'completed') !== nextClaims.completed) return fail();
      return response;
    },
  };
  return { ...runtime, readScorecard };
}
