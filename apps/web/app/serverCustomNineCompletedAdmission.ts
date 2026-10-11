import 'server-only';
import {
  createCustomNineIssuedChallengeService, validateCustomNinePuzzleId,
  type CustomNineIssuedChallenge,
} from '@initial-baseball/daily';
import { getDailyAtBatPoints, validateDailyCompletedResult } from '@initial-baseball/engine';
import type { DailyCompletedResult } from '@initial-baseball/shared';
import { inspectCustomNineAttemptEligibility } from './customNineAttemptEligibility';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';
import { createSupabaseCustomNineAdmissionRepository } from './supabaseCustomNineAdmissionRepository';
import { getDailyProgressionSecret } from './dailyProgressionSecret';

type Environment = Record<string, string | undefined>;
type AdmissionInput = Parameters<ReturnType<typeof createSupabaseCustomNineAdmissionRepository>['admit']>[0];
type Dependencies = {
  getSecret: (environment: Environment) => string;
  challenge: (puzzleId: string, environment: Environment) => Promise<CustomNineIssuedChallenge | null>;
  attempt: (puzzleId: string, digest: string, environment: Environment) => Promise<CustomNineAttemptState | null>;
  admit: (input: AdmissionInput, environment: Environment) => Promise<{ status: 'created' | 'existing'; submissionId: string }>;
};
const DEFAULT: Dependencies = {
  getSecret: getDailyProgressionSecret,
  challenge: (id, env) => createCustomNineIssuedChallengeService(
    createSupabaseCustomNineIssuedChallengeRepository(createServerSupabaseClient(env)),
  ).getById(id),
  attempt: (id, digest, env) => createSupabaseCustomNineAttemptRepository(
    createServerSupabaseClient(env),
  ).getByKey({ challengeId: id, browserKeyDigest: digest }),
  admit: (input, env) => createSupabaseCustomNineAdmissionRepository(
    createServerSupabaseClient(env),
  ).admit(input),
};

export type CustomNineCompletedAdmissionResult =
  | { kind: 'not_found' | 'invalid_credential' | 'incomplete' }
  | { kind: 'admitted'; status: 'created' | 'existing'; submissionId: string; summary: DailyCompletedResult['summary'] };

function invalidCompletion(): never {
  // Never propagate signed-token, clue, player or stored database contents.
  throw new Error('Invalid authoritative Custom Nine completed attempt.');
}

/**
 * Server-only eligibility + authoritative points-v4 scorer. No browser route
 * exists for this service. Historical stateless signed receipts are irrelevant:
 * only the durable completed attempt for this exact signed cookie contributes.
 */
export function createServerCustomNineCompletedAdmissionService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Environment; dependencies?: Dependencies } = {}) {
  return {
    async admit(puzzleId: unknown, cookieHeader: string | null): Promise<CustomNineCompletedAdmissionResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomNinePuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }
      const challenge = await dependencies.challenge(puzzleId, environment);
      if (challenge === null) return { kind: 'not_found' };
      if (challenge.puzzleId !== puzzleId || challenge.rulesetVersion !== 'points-v4') invalidCompletion();

      const secret = dependencies.getSecret(environment);
      const eligible = inspectCustomNineAttemptEligibility(secret, cookieHeader, puzzleId);
      if (eligible.kind !== 'valid') return { kind: 'invalid_credential' };
      const state = await dependencies.attempt(puzzleId, eligible.browserKeyDigest, environment);
      if (state === null || state.challengeId !== puzzleId
        || state.browserKeyDigest !== eligible.browserKeyDigest) return { kind: 'invalid_credential' };
      if (state.status !== 'completed') return { kind: 'incomplete' };
      if (state.completedAt === null || state.terminalAtBats.length !== 9
        || challenge.clueSnapshot.pitches.length !== 9) invalidCompletion();

      let claims;
      try { claims = createCustomNineProgressionTokens(secret).verify(state.currentProgressionToken); }
      catch { return invalidCompletion(); }
      const strikeouts = state.terminalAtBats.filter(fact => fact.outcome === 'K').length;
      if (claims.version !== 1 || claims.rulesetVersion !== 'points-v4'
        || claims.puzzleId !== puzzleId || claims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
        || claims.pitchNumber !== 9 || !claims.completed || claims.revealCount !== 0
        || claims.strikeCount !== 0 || claims.outCount !== Math.min(3, strikeouts)) invalidCompletion();

      const pitches = challenge.clueSnapshot.pitches.map((pitch, i) => {
        if (pitch.pitchNumber !== i + 1 || !pitch.initials.trim()
          || state.terminalAtBats[i]?.initials !== pitch.initials) invalidCompletion();
        return { pitchNumber: pitch.pitchNumber, initials: pitch.initials };
      });
      const submission = {
        schemaVersion: 1, submissionId: state.attemptId,
        puzzleId, puzzleDate: CUSTOM_NINE_SESSION_DATE, puzzleNumber: 1,
        rulesetVersion: 'points-v4',
        completedAtBats: state.terminalAtBats.map(fact => ({ ...fact })),
      };
      const validated = validateDailyCompletedResult({
        submission, puzzle: { id: puzzleId, puzzleDate: CUSTOM_NINE_SESSION_DATE, puzzleNumber: 1, pitches },
        rulesetVersion: 'points-v4',
      });
      if (!validated.ok || validated.result.rulesetVersion !== 'points-v4') invalidCompletion();
      const awards = validated.result.completedAtBats.map(fact =>
        getDailyAtBatPoints({ ...fact, rulesetVersion: 'points-v4' }));
      if (awards.reduce((sum, points) => sum + points, 0) !== validated.result.summary.points) {
        invalidCompletion();
      }
      const committed = await dependencies.admit({
        challengeId: puzzleId,
        browserKeyDigest: eligible.browserKeyDigest,
        submissionId: state.attemptId,
        summary: validated.result.summary,
        awardedPoints: awards,
      }, environment);
      if (committed.submissionId !== state.attemptId) invalidCompletion();
      return {
        kind: 'admitted', status: committed.status,
        submissionId: state.attemptId, summary: validated.result.summary,
      };
    },
  };
}
