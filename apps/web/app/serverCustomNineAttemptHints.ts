import 'server-only';
import { createCustomNineIssuedChallengeService, validateCustomNinePuzzleId } from '@initial-baseball/daily';
import { CUSTOM_NINE_SESSION_DATE, createCustomNineProgressionTokens } from './serverCustomNineBootstrap';
import { createServerCustomNineHintService } from './serverCustomNineHints';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { inspectCustomNineAttemptEligibility } from './customNineAttemptEligibility';
import { DailyProgressionTokenError, type DailyProgressionClaims } from './dailyProgressionToken';

type Repository = Pick<ReturnType<typeof createSupabaseCustomNineAttemptRepository>, 'getByKey' | 'advance'>;
type RevealedHint = NonNullable<Awaited<ReturnType<ReturnType<typeof createServerCustomNineHintService>['revealHint']>>>;
type Dependencies = {
  challengeExists: (puzzleId: string, environment: Record<string, string | undefined>) => Promise<boolean>;
  repository: (environment: Record<string, string | undefined>) => Repository;
  revealHint: (puzzleId: string, token: string) => Promise<RevealedHint | null>;
  getSecret: (environment: Record<string, string | undefined>) => string;
};
const DEFAULT_DEPENDENCIES: Dependencies = {
  challengeExists: async (id, env) => {
    const repo = createSupabaseCustomNineIssuedChallengeRepository(createServerSupabaseClient(env));
    return (await createCustomNineIssuedChallengeService(repo).getById(id)) !== null;
  },
  repository: env => createSupabaseCustomNineAttemptRepository(createServerSupabaseClient(env)),
  revealHint: (id, token) => createServerCustomNineHintService().revealHint(id, token),
  getSecret: getDailyProgressionSecret,
};

export type CustomNineAttemptHintResult =
  | { kind: 'not_found' | 'invalid_credential' | 'completed' | 'invalid_progression' | 'conflict' }
  | { kind: 'revealed'; hint: RevealedHint['hint']; progressionToken: string; revision: number };

function validScope(claims: DailyProgressionClaims, puzzleId: string) {
  return claims.puzzleId === puzzleId
    && claims.puzzleDate === CUSTOM_NINE_SESSION_DATE
    && claims.rulesetVersion === 'points-v4'
    && !claims.completed;
}
function oneHintStep(before: DailyProgressionClaims, after: DailyProgressionClaims) {
  return after.version === before.version
    && after.rulesetVersion === before.rulesetVersion
    && after.puzzleId === before.puzzleId
    && after.puzzleDate === before.puzzleDate
    && after.pitchNumber === before.pitchNumber
    && after.revealCount === before.revealCount + 1
    && after.strikeCount === before.strikeCount
    && after.outCount === before.outCount
    && after.completed === before.completed;
}

/**
 * Staged scored-hint path, distinct from legacy stateless Custom hints.
 * The client must echo the exact previously issued token; a retry of the
 * same token is a conflict rather than revealing the next hint.
 */
export function createServerCustomNineAttemptHintService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: Dependencies;
} = {}) {
  return {
    async reveal(puzzleId: unknown, cookieHeader: string | null, expectedToken: unknown)
      : Promise<CustomNineAttemptHintResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomNinePuzzleId(puzzleId); } catch { return { kind: 'not_found' }; }
      if (typeof expectedToken !== 'string' || expectedToken.length === 0 || expectedToken.length > 4096) {
        return { kind: 'invalid_progression' };
      }
      // Public challenge existence is already discoverable through redacted
      // metadata. Resolve it first so unknown, well-formed IDs honor 404.
      if (!await dependencies.challengeExists(puzzleId, environment)) return { kind: 'not_found' };
      const secret = dependencies.getSecret(environment);
      const eligible = inspectCustomNineAttemptEligibility(secret, cookieHeader, puzzleId);
      if (eligible.kind !== 'valid') return { kind: 'invalid_credential' };

      const codec = createCustomNineProgressionTokens(secret);
      let before: DailyProgressionClaims;
      try {
        before = codec.verify(expectedToken);
      } catch (error) {
        if (error instanceof DailyProgressionTokenError) return { kind: 'invalid_progression' };
        throw error;
      }
      if (!validScope(before, puzzleId) || before.revealCount >= 4) {
        return { kind: 'invalid_progression' };
      }
      const repo = dependencies.repository(environment);
      const state = await repo.getByKey({ challengeId: puzzleId, browserKeyDigest: eligible.browserKeyDigest });
      if (state === null) return { kind: 'invalid_credential' };
      if (state.status === 'completed') return { kind: 'completed' };
      if (state.currentProgressionToken !== expectedToken) return { kind: 'conflict' };

      const revealed = await dependencies.revealHint(puzzleId, expectedToken);
      if (revealed === null) return { kind: 'not_found' };
      // Even though the existing hint service verifies the frozen puzzle and
      // signs the successor, check its one-hint transition independently here.
      let after: DailyProgressionClaims;
      try { after = codec.verify(revealed.progressionToken); }
      catch { throw new Error('Invalid Custom Nine signed hint transition.'); }
      if (!oneHintStep(before, after)) throw new Error('Invalid Custom Nine signed hint transition.');
      const committed = await repo.advance(state, { progressionToken: revealed.progressionToken });
      if (committed.status === 'conflict') return { kind: 'conflict' };
      return {
        kind: 'revealed',
        progressionToken: committed.state.currentProgressionToken,
        revision: committed.state.revision,
        hint: revealed.hint,
      };
    },
  };
}
