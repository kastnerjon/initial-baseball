import 'server-only';
import { createCustomNineIssuedChallengeService, validateCustomNinePuzzleId } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerCustomNineHintService } from './serverCustomNineHints';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { inspectCustomNineAttemptEligibility } from './customNineAttemptEligibility';
import { DailyProgressionTokenError, type DailyProgressionClaims } from './dailyProgressionToken';
import type { DailyResolutionRequest } from './dailyRuntimeContracts';

type AttemptRepository = Pick<ReturnType<typeof createSupabaseCustomNineAttemptRepository>, 'getByKey' | 'advance'>;
type Resolver = ReturnType<typeof createServerCustomNineHintService>['resolveAtBat'];
type Dependencies = {
  challengeExists: (id: string, env: Record<string, string | undefined>) => Promise<boolean>;
  repository: (env: Record<string, string | undefined>) => AttemptRepository;
  resolve: Resolver;
  getSecret: (env: Record<string, string | undefined>) => string;
};
const DEFAULT_DEPENDENCIES: Dependencies = {
  challengeExists: async (id, env) => {
    const client: SupabaseClient = createServerSupabaseClient(env);
    return await createCustomNineIssuedChallengeService(
      createSupabaseCustomNineIssuedChallengeRepository(client),
    ).getById(id) !== null;
  },
  repository: env => createSupabaseCustomNineAttemptRepository(createServerSupabaseClient(env)),
  resolve: (id, request) => createServerCustomNineHintService().resolveAtBat(id, request),
  getSecret: getDailyProgressionSecret,
};

export type CustomNineIncorrectGuessResult =
  | { kind: 'not_found' | 'invalid_credential' | 'invalid_progression' | 'conflict' | 'completed' }
  | { kind: 'terminal_pending' }
  | { kind: 'incorrect'; progressionToken: string; revision: number; strikeCount: 1 | 2 };

function scoped(claims: DailyProgressionClaims, puzzleId: string): boolean {
  return claims.version === 1 && claims.rulesetVersion === 'points-v4'
    && claims.puzzleId === puzzleId && claims.puzzleDate === CUSTOM_NINE_SESSION_DATE
    && !claims.completed;
}
function exactIncorrectStep(before: DailyProgressionClaims, after: DailyProgressionClaims): boolean {
  return scoped(after, before.puzzleId)
    && after.pitchNumber === before.pitchNumber
    && after.revealCount === before.revealCount
    && after.strikeCount === before.strikeCount + 1
    && after.outCount === before.outCount;
}

/**
 * Private composition seam, deliberately NO HTTP route.
 * Nonterminal incorrect guesses commit under the exact saved Custom token;
 * correct guesses, third strikes and Give Up require a later complete terminal
 * authority so this cannot become a free answer-testing oracle.
 */
export function createServerCustomNineIncorrectGuessService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: Dependencies;
} = {}) {
  return {
    async attempt(
      puzzleId: unknown, cookieHeader: string | null,
      request: DailyResolutionRequest,
    ): Promise<CustomNineIncorrectGuessResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomNinePuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }
      if (!request || typeof request.progressionToken !== 'string'
        || request.progressionToken.length === 0 || request.progressionToken.length > 4096
        || typeof request.submittedPlayerId !== 'string'
        || request.submittedPlayerId.trim().length === 0
        || request.submittedPlayerId.length > 200 || request.giveUp !== undefined) {
        return { kind: 'invalid_progression' };
      }
      if (!await dependencies.challengeExists(puzzleId, environment)) return { kind: 'not_found' };
      const secret = dependencies.getSecret(environment);
      const eligible = inspectCustomNineAttemptEligibility(secret, cookieHeader, puzzleId);
      if (eligible.kind !== 'valid') return { kind: 'invalid_credential' };
      const tokens = createCustomNineProgressionTokens(secret);
      const token = request.progressionToken;
      let before: DailyProgressionClaims;
      try { before = tokens.verify(token); }
      catch (error) {
        if (error instanceof DailyProgressionTokenError) return { kind: 'invalid_progression' };
        throw error;
      }
      if (!scoped(before, puzzleId)) return { kind: 'invalid_progression' };
      const repo = dependencies.repository(environment);
      const state = await repo.getByKey({ challengeId: puzzleId, browserKeyDigest: eligible.browserKeyDigest });
      if (state === null) return { kind: 'invalid_credential' };
      if (state.status !== 'active') return { kind: 'completed' };
      if (state.currentProgressionToken !== token) return { kind: 'conflict' };
      if (state.terminalAtBats.length !== before.pitchNumber - 1) {
        throw new Error('Custom Nine terminal progression integrity unavailable.');
      }
      // The third strike always requires a terminal append, handled separately.
      if (before.strikeCount === 2) return { kind: 'terminal_pending' };

      const result = await dependencies.resolve(puzzleId, {
        progressionToken: token, submittedPlayerId: request.submittedPlayerId,
      });
      if (result === null) return { kind: 'not_found' };
      if (result.result.kind !== 'incorrect') return { kind: 'terminal_pending' };
      // No terminal receipt/answer reveal may be included in a nonterminal action.
      if (result.reveal !== null || result.terminalReceipt !== null) {
        throw new Error('Custom Nine incorrect-guess response integrity unavailable.');
      }
      let after: DailyProgressionClaims;
      try { after = tokens.verify(result.progressionToken); }
      catch { throw new Error('Custom Nine incorrect-guess signature unavailable.'); }
      if (!exactIncorrectStep(before, after) || result.result.strikeCount !== after.strikeCount) {
        throw new Error('Custom Nine incorrect-guess transition integrity unavailable.');
      }
      const committed = await repo.advance(state, { progressionToken: result.progressionToken });
      if (committed.status === 'conflict') return { kind: 'conflict' };
      return {
        kind: 'incorrect', progressionToken: committed.state.currentProgressionToken,
        revision: committed.state.revision, strikeCount: after.strikeCount as 1 | 2,
      };
    },
  };
}
