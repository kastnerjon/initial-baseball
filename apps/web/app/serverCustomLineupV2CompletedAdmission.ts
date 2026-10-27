import 'server-only';
import {
  cloneCustomLineupIssuedChallenge, validateCustomLineupPuzzleId,
  type CustomLineupIssuedChallenge,
} from '@initial-baseball/daily';
import {
  applyDailyOutcomeForRuleset, createDailyPointsSummary, getDailyAtBatPoints,
  normalizeDailyTerminalAtBat, type DailyRulesetEngineState,
} from '@initial-baseball/engine';
import {
  DEFAULT_DAILY_BASE_STATE, DEFAULT_DAILY_SCORE_SUMMARY,
  type DailyPointsSummary, type DailyPublicPuzzle,
} from '@initial-baseball/shared';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { validCustomLineupV2SavedHistory } from './serverCustomLineupV2AttemptHints';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomLineupV2IssuedReader } from './supabaseCustomLineupV2IssuedReader';
import { createSupabaseCustomLineupV2ReservationRepository } from './supabaseCustomLineupV2ReservationRepository';
import {
  createSupabaseCustomLineupV2AdmissionRepository,
  type CustomLineupV2AdmissionInput,
} from './supabaseCustomLineupV2AdmissionRepository';

type Environment = Record<string, string | undefined>;
type Summary = DailyPointsSummary & { strikeouts: number };
type Dependencies = {
  getSecret: (env: Environment) => string;
  challenge: (id: string, env: Environment) => Promise<CustomLineupIssuedChallenge | null>;
  attempt: (id: string, digest: string, n: number, env: Environment) =>
    Promise<CustomNineAttemptState | null>;
  admit: (input: CustomLineupV2AdmissionInput, env: Environment) =>
    Promise<{ status: 'created' | 'existing'; submissionId: string }>;
};
const DEFAULT: Dependencies = {
  getSecret: getDailyProgressionSecret,
  challenge: (id, env) =>
    createSupabaseCustomLineupV2IssuedReader(createServerSupabaseClient(env)).getById(id),
  attempt: (id, digest, n, env) =>
    createSupabaseCustomLineupV2ReservationRepository(createServerSupabaseClient(env), n)
      .getByKey({ challengeId: id, browserKeyDigest: digest }),
  admit: (input, env) =>
    createSupabaseCustomLineupV2AdmissionRepository(createServerSupabaseClient(env)).admit(input),
};

export type CustomLineupV2CompletedAdmissionResult =
  | { kind: 'not_found' | 'invalid_credential' | 'incomplete' }
  | { kind: 'admitted'; status: 'created' | 'existing'; submissionId: string; summary: Summary };

function invalidCompletion(): never {
  // No signed tokens, issued answers, stored facts or database details leave this boundary.
  throw new Error('Invalid authoritative Custom Lineup v2 completed attempt.');
}

/** Private service; no HTTP consumer or public competition activation.
 * Exactly one browser's durable completed first attempt may enter the
 * existing atomic v2 result+per-batter RPC, with engine-derived scoring.
 */
export function createServerCustomLineupV2CompletedAdmissionService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Environment; dependencies?: Dependencies } = {}) {
  return {
    async admit(puzzleId: unknown, cookieHeader: string | null):
      Promise<CustomLineupV2CompletedAdmissionResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }

      const row = await dependencies.challenge(puzzleId, environment);
      if (row === null) return { kind: 'not_found' };
      const challenge = cloneCustomLineupIssuedChallenge(row);
      const n = challenge.canonicalPlayerIds.length;
      if (challenge.puzzleId !== puzzleId || challenge.rulesetVersion !== 'points-v4'
        || n < 1 || n > 10 || challenge.clueSnapshot.pitches.length !== n) invalidCompletion();

      const secret = dependencies.getSecret(environment);
      const creator = createCustomLineupV2CreatorBrowserMarker(secret).inspect(cookieHeader, puzzleId);
      const browser = createCustomLineupV2AttemptBrowserCredential(secret).inspect(cookieHeader, puzzleId);
      if (creator !== 'unmarked' || browser.kind !== 'valid') {
        return { kind: 'invalid_credential' };
      }
      const state = await dependencies.attempt(puzzleId, browser.browserKeyDigest, n, environment);
      if (state === null || state.challengeId !== puzzleId
        || state.browserKeyDigest !== browser.browserKeyDigest) {
        return { kind: 'invalid_credential' };
      }
      if (state.creatorSeen === true) return { kind: 'invalid_credential' };
      if (state.status !== 'completed') return { kind: 'incomplete' };
      if (state.completedAt === null || state.terminalAtBats.length !== n) invalidCompletion();

      let claims;
      try { claims = createCustomLineupV2ProgressionTokens(secret).verify(state.currentProgressionToken); }
      catch { return invalidCompletion(); }
      if (claims.version !== 1 || claims.puzzleId !== puzzleId
        || claims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
        || claims.rulesetVersion !== 'points-v4' || !claims.completed
        || claims.pitchNumber !== n || claims.revealCount !== 0 || claims.strikeCount !== 0
        || !validCustomLineupV2SavedHistory(state, claims, challenge)) invalidCompletion();

      const { summary, awardedPoints } = scoreCompletedAttempt(state, challenge);
      const committed = await dependencies.admit({
        challengeId: puzzleId, browserKeyDigest: browser.browserKeyDigest,
        submissionId: state.attemptId, atBatCount: n, summary, awardedPoints,
      }, environment);
      if (committed.submissionId !== state.attemptId) invalidCompletion();
      return {
        kind: 'admitted', status: committed.status,
        submissionId: state.attemptId, summary,
      };
    },
  };
}

/** Reuse the portable points-v4 engine for immutable N rather than weakening
 * the historical nine-only Daily completed-result submission validator.
 */
function scoreCompletedAttempt(
  state: CustomNineAttemptState, challenge: CustomLineupIssuedChallenge,
): { summary: Summary; awardedPoints: number[] } {
  const n = challenge.canonicalPlayerIds.length;
  let game: DailyRulesetEngineState = {
    inning: {
      inningNumber: 1, outs: 0, maxOuts: 3, bases: { ...DEFAULT_DAILY_BASE_STATE },
      completedAtBats: [], currentAtBat: null,
    },
    score: { ...DEFAULT_DAILY_SCORE_SUMMARY },
    points: createDailyPointsSummary('points-v4', n),
  };
  const awardedPoints: number[] = [];
  for (const [index, rawFact] of state.terminalAtBats.entries()) {
    const pitch = challenge.clueSnapshot.pitches[index];
    if (!pitch || pitch.pitchNumber !== index + 1 || game.points.completed) invalidCompletion();
    const normalized = normalizeDailyTerminalAtBat(rawFact, {
      pitchNumber: pitch.pitchNumber, initials: pitch.initials,
    } as DailyPublicPuzzle['pitches'][number]);
    if (!normalized.ok) invalidCompletion();
    const fact = normalized.atBat;
    awardedPoints.push(getDailyAtBatPoints({ ...fact, rulesetVersion: 'points-v4' }));
    game = applyDailyOutcomeForRuleset({
      ...game, ...fact, rulesetVersion: 'points-v4', totalAtBats: n,
    });
  }
  if (awardedPoints.length !== n || !game.points.completed
    || game.points.atBatsCompleted !== n
    || game.points.maximumPoints !== 4 * n
    || awardedPoints.reduce((a, b) => a + b, 0) !== game.points.points) invalidCompletion();
  return { summary: { ...game.points, strikeouts: game.score.strikeouts }, awardedPoints };
}
