import 'server-only';
import { cloneCustomLineupIssuedChallenge, validateCustomLineupPuzzleId, type CustomLineupIssuedChallenge } from '@initial-baseball/daily';
import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyPublicPuzzle, Player } from '@initial-baseball/shared';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { DailyProgressionTokenError, type DailyProgressionClaims } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { DailyRuntimeRequestError, createDailyRuntimeService } from './dailyRuntimeService';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { CUSTOM_NINE_SESSION_DATE, materializeCustomNineSessionPuzzle } from './serverCustomNineBootstrap';
import { createCustomLineupV2ProgressionTokens } from './serverCustomLineupV2Bootstrap';
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

type Hint = Awaited<ReturnType<ReturnType<typeof createDailyRuntimeService>['revealHint']>>['hint'];
export type CustomLineupV2AttemptHintResult =
  | { kind: 'not_found' | 'invalid_credential' | 'invalid_progression' | 'completed' | 'conflict' }
  | { kind: 'revealed'; hint: Hint; progressionToken: string; revision: number };

function signedScope(claims: DailyProgressionClaims, id: string, n: number) {
  return claims.version === 1 && claims.puzzleId === id
    && claims.puzzleDate === CUSTOM_NINE_SESSION_DATE && claims.rulesetVersion === 'points-v4'
    && !claims.completed && claims.pitchNumber >= 1 && claims.pitchNumber <= n
    && claims.revealCount < 4;
}
function oneHintStep(before: DailyProgressionClaims, after: DailyProgressionClaims) {
  return after.version === before.version && after.puzzleId === before.puzzleId
    && after.puzzleDate === before.puzzleDate && after.rulesetVersion === before.rulesetVersion
    && after.pitchNumber === before.pitchNumber && after.revealCount === before.revealCount + 1
    && after.strikeCount === before.strikeCount && after.outCount === before.outCount
    && !after.completed;
}

/** Verify immutable terminal facts and exact durable mutation count for active
 * and completed v2 attempts. Does not authorize a mutation or expose clues.
 */
export function validCustomLineupV2SavedHistory(state: CustomNineAttemptState, claims: DailyProgressionClaims,
  challenge: CustomLineupIssuedChallenge) {
  const n = challenge.canonicalPlayerIds.length;
  const completed = state.status === 'completed';
  if (claims.completed !== completed
    || state.terminalAtBats.length !== (completed ? n : claims.pitchNumber - 1)
    || (completed && (claims.pitchNumber !== n || claims.revealCount !== 0
      || claims.strikeCount !== 0))) return false;
  let priorRevisions = 0;
  let outs = 0;
  for (const [i, fact] of state.terminalAtBats.entries()) {
    const expected = challenge.clueSnapshot.pitches[i];
    if (!expected || expected.pitchNumber !== i + 1 || fact.pitchNumber !== i + 1
      || fact.initials !== expected.initials
      || !normalizeDailyTerminalAtBat(fact, {
        pitchNumber: i + 1, initials: expected.initials,
      } as DailyPublicPuzzle['pitches'][number]).ok) return false;
    priorRevisions += 1 + fact.hintsRevealed
      + (fact.resolution === 'strikeout' ? 2 : fact.wrongGuesses);
    if (fact.outcome === 'K') outs += 1;
  }
  return claims.outCount === Math.min(3, outs)
    && state.revision === priorRevisions
      + (completed ? 0 : claims.revealCount + claims.strikeCount);
}

/** Private v2 only. No HTTP consumer or result admission. One signed hint per durable CAS. */
export function createServerCustomLineupV2AttemptHintService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Record<string, string | undefined>; dependencies?: Dependencies } = {}) {
  return {
    async reveal(puzzleId: unknown, cookieHeader: string | null, expectedToken: unknown)
      : Promise<CustomLineupV2AttemptHintResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }
      if (typeof expectedToken !== 'string' || !expectedToken || expectedToken.length > 4096) {
        return { kind: 'invalid_progression' };
      }

      const row = await dependencies.readChallenge(puzzleId, environment);
      if (row === null) return { kind: 'not_found' };
      const challenge = cloneCustomLineupIssuedChallenge(row);
      if (challenge.puzzleId !== puzzleId) throw new Error('Custom v2 hint challenge identity mismatch.');
      const n = challenge.canonicalPlayerIds.length;
      const secret = dependencies.getSecret(environment);
      const creator = createCustomLineupV2CreatorBrowserMarker(secret).inspect(cookieHeader, puzzleId);
      const browser = createCustomLineupV2AttemptBrowserCredential(secret).inspect(cookieHeader, puzzleId);
      if (creator !== 'unmarked' || browser.kind !== 'valid') return { kind: 'invalid_credential' };

      const tokens = createCustomLineupV2ProgressionTokens(secret);
      let before: DailyProgressionClaims;
      try { before = tokens.verify(expectedToken); }
      catch (error) {
        if (error instanceof DailyProgressionTokenError) return { kind: 'invalid_progression' };
        throw error;
      }
      if (!signedScope(before, puzzleId, n)) return { kind: 'invalid_progression' };

      const repository = dependencies.repository(environment, n);
      const state = await repository.getByKey({
        challengeId: puzzleId, browserKeyDigest: browser.browserKeyDigest,
      });
      if (state === null) return { kind: 'invalid_credential' };
      if (state.status === 'completed') return { kind: 'completed' };
      if (state.currentProgressionToken !== expectedToken) return { kind: 'conflict' };
      if (!validCustomLineupV2SavedHistory(state, before, challenge)) return { kind: 'invalid_progression' };

      // The frozen challenge is server-only. Only the newly authorized clue is returned.
      const puzzle = materializeCustomNineSessionPuzzle(challenge, dependencies.resolvePlayer);
      const runtime = createDailyRuntimeService({
        createPuzzle: date => {
          if (date !== CUSTOM_NINE_SESSION_DATE) throw new Error('Invalid v2 hint date.');
          return puzzle;
        },
        progressionTokens: tokens,
        resolveLegacyPlayerId: () => { throw new Error('Legacy IDs unsupported.'); },
        getCanonicalReveal: () => { throw new Error('Answer reveal unsupported.'); },
      });
      let revealed: Awaited<ReturnType<typeof runtime.revealHint>>;
      try { revealed = await runtime.revealHint(expectedToken); }
      catch (error) {
        if (error instanceof DailyRuntimeRequestError) return { kind: 'invalid_progression' };
        throw error;
      }
      let after: DailyProgressionClaims;
      try { after = tokens.verify(revealed.progressionToken); }
      catch { throw new Error('Invalid Custom v2 signed hint successor.'); }
      if (!oneHintStep(before, after)) throw new Error('Invalid Custom v2 signed hint successor.');
      const committed = await repository.advanceHint(state, revealed.progressionToken);
      if (committed.status === 'conflict') return { kind: 'conflict' };
      return {
        kind: 'revealed', hint: revealed.hint,
        progressionToken: committed.state.currentProgressionToken,
        revision: committed.state.revision,
      };
    },
  };
}
