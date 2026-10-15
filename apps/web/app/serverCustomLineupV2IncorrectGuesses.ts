import 'server-only';
import { cloneCustomLineupIssuedChallenge, validateCustomLineupPuzzleId, type CustomLineupIssuedChallenge } from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { DailyProgressionTokenError, type DailyProgressionClaims } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { DailyRuntimeRequestError, createDailyRuntimeService } from './dailyRuntimeService';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { CUSTOM_NINE_SESSION_DATE, materializeCustomNineSessionPuzzle } from './serverCustomNineBootstrap';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
import { validCustomLineupV2SavedHistory } from './serverCustomLineupV2AttemptHints';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomLineupV2IssuedReader } from './supabaseCustomLineupV2IssuedReader';
import { createSupabaseCustomLineupV2ReservationRepository } from './supabaseCustomLineupV2ReservationRepository';

type Repository = Pick<ReturnType<typeof createSupabaseCustomLineupV2ReservationRepository>, 'getByKey' | 'advanceHint'>;
type Dependencies = {
  readChallenge: (id: string, env: Record<string, string | undefined>) => Promise<CustomLineupIssuedChallenge | null>;
  repository: (env: Record<string, string | undefined>, n: number) => Repository;
  resolvePlayer: (id: string) => Player | null;
  getSecret: (env: Record<string, string | undefined>) => string;
};
const DEFAULT: Dependencies = {
  readChallenge: (id, env) => createSupabaseCustomLineupV2IssuedReader(createServerSupabaseClient(env)).getById(id),
  repository: (env, n) => createSupabaseCustomLineupV2ReservationRepository(createServerSupabaseClient(env), n),
  resolvePlayer: getCanonicalDailyPlayer,
  getSecret: getDailyProgressionSecret,
};

export type CustomLineupV2IncorrectGuessResult =
  | { kind: 'not_found' | 'invalid_credential' | 'invalid_progression' | 'completed' | 'conflict' }
  | { kind: 'terminal_pending' }
  | { kind: 'incorrect'; progressionToken: string; revision: number; strikeCount: 1 | 2 };

function validScope(claims: DailyProgressionClaims, id: string, n: number): boolean {
  return claims.version === 1 && claims.rulesetVersion === 'points-v4'
    && claims.puzzleId === id && claims.puzzleDate === CUSTOM_NINE_SESSION_DATE
    && !claims.completed && claims.pitchNumber >= 1 && claims.pitchNumber <= n
    && claims.strikeCount >= 0 && claims.strikeCount <= 2;
}
function exactIncorrectStep(before: DailyProgressionClaims, after: DailyProgressionClaims): boolean {
  return after.version === before.version && after.rulesetVersion === before.rulesetVersion
    && after.puzzleId === before.puzzleId && after.puzzleDate === before.puzzleDate
    && after.pitchNumber === before.pitchNumber && after.revealCount === before.revealCount
    && after.strikeCount === before.strikeCount + 1 && after.outCount === before.outCount
    && !after.completed;
}

/** Private, nonterminal incorrect guesses only. Correct guesses and third strikes
 * are deliberately withheld until terminal ledger admission is available.
 */
export function createServerCustomLineupV2IncorrectGuessService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Record<string, string | undefined>; dependencies?: Dependencies } = {}) {
  return {
    async attempt(puzzleId: unknown, cookieHeader: string | null, request: unknown)
      : Promise<CustomLineupV2IncorrectGuessResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }
      if (!request || typeof request !== 'object' || Array.isArray(request)) return { kind: 'invalid_progression' };
      const input = request as Record<string, unknown>;
      if (typeof input.progressionToken !== 'string' || !input.progressionToken
        || input.progressionToken.length > 4096
        || typeof input.submittedPlayerId !== 'string'
        || !/^ibp_[0-9a-f]{20}$/.test(input.submittedPlayerId)
        || Object.keys(input).some(key => key !== 'progressionToken' && key !== 'submittedPlayerId')) {
        return { kind: 'invalid_progression' };
      }

      const row = await dependencies.readChallenge(puzzleId, environment);
      if (row === null) return { kind: 'not_found' };
      const challenge = cloneCustomLineupIssuedChallenge(row);
      if (challenge.puzzleId !== puzzleId) throw new Error('Custom v2 incorrect challenge identity mismatch.');
      const n = challenge.canonicalPlayerIds.length;
      const secret = dependencies.getSecret(environment);
      const creator = createCustomLineupV2CreatorBrowserMarker(secret).inspect(cookieHeader, puzzleId);
      const browser = createCustomLineupV2AttemptBrowserCredential(secret).inspect(cookieHeader, puzzleId);
      if (creator !== 'unmarked' || browser.kind !== 'valid') return { kind: 'invalid_credential' };
      const tokens = createCustomLineupV2ProgressionTokens(secret);
      const token = input.progressionToken;
      let before: DailyProgressionClaims;
      try { before = tokens.verify(token); }
      catch (error) {
        if (error instanceof DailyProgressionTokenError) return { kind: 'invalid_progression' };
        throw error;
      }
      if (!validScope(before, puzzleId, n)) return { kind: 'invalid_progression' };

      const repository = dependencies.repository(environment, n);
      const state = await repository.getByKey({
        challengeId: puzzleId, browserKeyDigest: browser.browserKeyDigest,
      });
      if (state === null) return { kind: 'invalid_credential' };
      if (state.status === 'completed') return { kind: 'completed' };
      if (state.currentProgressionToken !== token) return { kind: 'conflict' };
      if (!validCustomLineupV2SavedHistory(state, before, challenge)) return { kind: 'invalid_progression' };
      if (before.strikeCount === 2) return { kind: 'terminal_pending' };

      const puzzle = materializeCustomNineSessionPuzzle(challenge, dependencies.resolvePlayer);
      const runtime = createDailyRuntimeService({
        createPuzzle: date => {
          if (date !== CUSTOM_NINE_SESSION_DATE) throw new Error('Invalid v2 incorrect date.');
          return puzzle;
        },
        progressionTokens: tokens,
        resolveLegacyPlayerId: () => { throw new DailyRuntimeRequestError('Legacy IDs unsupported.'); },
        getCanonicalReveal: () => { throw new Error('Terminal reveal unsupported.'); },
      });
      let resolved: Awaited<ReturnType<typeof runtime.resolveAtBat>>;
      try {
        resolved = await runtime.resolveAtBat({
          progressionToken: token, submittedPlayerId: input.submittedPlayerId,
        });
      } catch (error) {
        if (error instanceof DailyRuntimeRequestError) return { kind: 'invalid_progression' };
        // Correct guesses and strikeouts cannot disclose their answers here.
        // A missing terminal reveal is an expected private pending transition.
        if (error instanceof Error && error.message === 'Terminal reveal unsupported.') {
          return { kind: 'terminal_pending' };
        }
        throw error;
      }
      if (resolved.result.kind !== 'incorrect') return { kind: 'terminal_pending' };
      let after: DailyProgressionClaims;
      try { after = tokens.verify(resolved.progressionToken); }
      catch { throw new Error('Invalid Custom v2 signed incorrect successor.'); }
      if (!exactIncorrectStep(before, after) || resolved.result.strikeCount !== after.strikeCount) {
        throw new Error('Invalid Custom v2 signed incorrect successor.');
      }
      const committed = await repository.advanceHint(state, resolved.progressionToken);
      if (committed.status === 'conflict') return { kind: 'conflict' };
      return {
        kind: 'incorrect', progressionToken: committed.state.currentProgressionToken,
        revision: committed.state.revision, strikeCount: after.strikeCount as 1 | 2,
      };
    },
  };
}
