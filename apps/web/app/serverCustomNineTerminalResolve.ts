import 'server-only';
import { createHash } from 'node:crypto';
import { createCustomNineIssuedChallengeService, validateCustomNinePuzzleId } from '@initial-baseball/daily';
import { getGuessOutcome, normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomNineHintService } from './serverCustomNineHints';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { inspectCustomNineAttemptEligibility } from './customNineAttemptEligibility';
import { DailyProgressionTokenError, type DailyProgressionClaims } from './dailyProgressionToken';
import type { DailyResolutionRequest } from './dailyRuntimeContracts';
import { createCustomNineTerminalReceiptCodec } from './customNineTerminalReceipt';
import { projectCustomNineAttemptHintBundle } from './serverCustomNineAttemptBootstrap';

type Repo = Pick<ReturnType<typeof createSupabaseCustomNineAttemptRepository>, 'getByKey' | 'advance'>;
type Resolved = NonNullable<Awaited<ReturnType<ReturnType<typeof createServerCustomNineHintService>['resolveAtBat']>>>;
type Dependencies = {
  challengeExists: (puzzleId: string, env: Record<string, string | undefined>) => Promise<boolean>;
  repository: (env: Record<string, string | undefined>) => Repo;
  resolve: (puzzleId: string, request: DailyResolutionRequest, env: Record<string, string | undefined>) => Promise<Resolved | null>;
  getSecret: (env: Record<string, string | undefined>) => string;
};
const DEFAULT: Dependencies = {
  challengeExists: async (id, env) => {
    const repo = createSupabaseCustomNineIssuedChallengeRepository(createServerSupabaseClient(env));
    return (await createCustomNineIssuedChallengeService(repo).getById(id)) !== null;
  },
  repository: env => createSupabaseCustomNineAttemptRepository(createServerSupabaseClient(env)),
  resolve: (id, request, env) => createServerCustomNineHintService({ environment: env }).resolveAtBat(id, request),
  getSecret: getDailyProgressionSecret,
};
type ErrorKind = 'not_found' | 'invalid_credential' | 'invalid_progression' | 'completed' | 'conflict';
export type CustomNineTerminalResolution =
  | { kind: ErrorKind }
  | { kind: 'terminal'; result: Resolved['result']; reveal: Resolved['reveal'];
      progressionToken: string; hintBundle: Resolved['hintBundle']; revision: number };

function validScope(claims: DailyProgressionClaims, puzzleId: string): boolean {
  return claims.puzzleId === puzzleId && claims.puzzleDate === CUSTOM_NINE_SESSION_DATE
    && claims.rulesetVersion === 'points-v4' && !claims.completed;
}
function sameIdentity(before: DailyProgressionClaims, after: DailyProgressionClaims): boolean {
  return before.version === after.version && before.rulesetVersion === after.rulesetVersion
    && before.puzzleId === after.puzzleId && before.puzzleDate === after.puzzleDate;
}
function invalid(): never { throw new Error('Invalid authoritative Custom Nine terminal transition.'); }
function sha256(text: string): string { return createHash('sha256').update(text).digest('base64url'); }

/**
 * Private terminal-only CAS. Public route must dispatch nonterminal guesses
 * through the existing #372 service first; never publish a test-answer oracle.
 */
export function createServerCustomNineTerminalResolutionService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Record<string, string | undefined>; dependencies?: Dependencies } = {}) {
  return {
    async resolve(puzzleId: unknown, cookieHeader: string | null, request: DailyResolutionRequest)
      : Promise<CustomNineTerminalResolution> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomNinePuzzleId(puzzleId); } catch { return { kind: 'not_found' }; }
      const token = request.progressionToken;
      if (typeof token !== 'string' || !token || token.length > 4096
        || (request.giveUp !== true && (typeof request.submittedPlayerId !== 'string'
          || !request.submittedPlayerId.trim() || request.submittedPlayerId.length > 200))) {
        return { kind: 'invalid_progression' };
      }
      if (!await dependencies.challengeExists(puzzleId, environment)) return { kind: 'not_found' };
      const secret = dependencies.getSecret(environment);
      const eligible = inspectCustomNineAttemptEligibility(secret, cookieHeader, puzzleId);
      if (eligible.kind !== 'valid') return { kind: 'invalid_credential' };
      const codec = createCustomNineProgressionTokens(secret);
      let before: DailyProgressionClaims;
      try { before = codec.verify(token); }
      catch (error) {
        if (error instanceof DailyProgressionTokenError) return { kind: 'invalid_progression' };
        throw error;
      }
      if (!validScope(before, puzzleId)) return { kind: 'invalid_progression' };
      const repo = dependencies.repository(environment);
      const state = await repo.getByKey({ challengeId: puzzleId, browserKeyDigest: eligible.browserKeyDigest });
      if (state === null) return { kind: 'invalid_credential' };
      if (state.status === 'completed') return { kind: 'completed' };
      if (state.currentProgressionToken !== token) return { kind: 'conflict' };
      if (state.terminalAtBats.length + 1 !== before.pitchNumber) invalid();

      const resolved = await dependencies.resolve(puzzleId, request, environment);
      if (resolved === null) return { kind: 'not_found' };
      if (resolved.result.kind === 'incorrect') invalid(); // Never grant a free test-answer API.
      let after: DailyProgressionClaims;
      try { after = codec.verify(resolved.progressionToken); } catch { invalid(); }
      const result = resolved.result;
      const expectedResolution = request.giveUp === true ? 'give_up'
        : result.kind === 'correct' ? 'correct' : 'strikeout';
      const expectedOuts = Math.min(before.outCount + (result.kind === 'strikeout' ? 1 : 0), 3);
      const final = before.pitchNumber === 9;
      if (!sameIdentity(before, after)
        || after.pitchNumber !== (final ? 9 : before.pitchNumber + 1)
        || after.revealCount !== 0 || after.strikeCount !== 0
        || after.outCount !== expectedOuts || after.completed !== final
        || resolved.reveal === null || typeof resolved.terminalReceipt !== 'string'
        || (final ? resolved.hintBundle !== null : resolved.hintBundle === null)) invalid();
      const expectedCorrect = getGuessOutcome({
        isCorrect: true, revealCount: before.revealCount,
        strikeCount: before.strikeCount, maxStrikes: 3,
      });
      if (result.revealedCount !== before.revealCount
        || (result.kind === 'strikeout' && (result.strikeCount !== 3
          || (request.giveUp !== true && before.strikeCount !== 2)))
        || (result.kind === 'correct' && (request.giveUp === true
          || expectedCorrect.kind !== 'correct' || result.outcome !== expectedCorrect.outcome))) invalid();

      let evidence: ReturnType<ReturnType<typeof createCustomNineTerminalReceiptCodec>['verify']>;
      try { evidence = createCustomNineTerminalReceiptCodec(secret).verify(resolved.terminalReceipt!); }
      catch { invalid(); }
      const f = evidence.atBat;
      const wrong = expectedResolution === 'strikeout' ? 3 : before.strikeCount;
      if (evidence.puzzleId !== puzzleId || evidence.predecessorDigest !== sha256(token)
        || evidence.successorDigest !== sha256(resolved.progressionToken)
        || f.pitchNumber !== before.pitchNumber || f.hintsRevealed !== before.revealCount
        || f.wrongGuesses !== wrong || f.resolution !== expectedResolution
        || f.outcome !== result.outcome || !normalizeDailyTerminalAtBat(f, {
          pitchNumber: before.pitchNumber, initials: f.initials,
        }).ok) invalid();
      const fact: DailyCompletedAtBat = f;
      if (resolved.hintBundle !== null
        && (resolved.hintBundle.pitchNumber !== after.pitchNumber
          || resolved.hintBundle.revealedCount !== after.revealCount)) invalid();
      const committed = await repo.advance(state, {
        progressionToken: resolved.progressionToken, terminalAtBat: fact,
      });
      if (committed.status === 'conflict') return { kind: 'conflict' };
      return {
        kind: 'terminal', result, reveal: resolved.reveal,
        progressionToken: committed.state.currentProgressionToken,
        hintBundle: resolved.hintBundle === null ? null
          : projectCustomNineAttemptHintBundle(resolved.hintBundle),
        revision: committed.state.revision,
      };
    },
  };
}
