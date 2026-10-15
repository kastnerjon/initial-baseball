import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import {
  createCustomLineupV2ProgressionTokens, createServerCustomLineupV2BootstrapService,
} from './serverCustomLineupV2Bootstrap';
import { projectCustomNineAttemptHintBundle } from './serverCustomNineAttemptBootstrap';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomLineupV2ReservationRepository } from './supabaseCustomLineupV2ReservationRepository';

type Opening = NonNullable<Awaited<ReturnType<ReturnType<typeof createServerCustomLineupV2BootstrapService>['bootstrap']>>>;
type Ledger = Pick<ReturnType<typeof createSupabaseCustomLineupV2ReservationRepository>,
  'getByKey' | 'getOrCreate'>;
type Dependencies = {
  opening: (id: string, env: Record<string, string | undefined>) => Promise<Opening | null>;
  repository: (env: Record<string, string | undefined>, n: number) => Ledger;
  getSecret: (env: Record<string, string | undefined>) => string;
};
const DEFAULT: Dependencies = {
  opening: (id, env) => createServerCustomLineupV2BootstrapService({ environment: env }).bootstrap(id),
  repository: (env, n) => createSupabaseCustomLineupV2ReservationRepository(createServerSupabaseClient(env), n),
  getSecret: getDailyProgressionSecret,
};
type Result =
  | { kind: 'not_found' | 'invalid_credential' | 'completed' | 'continuation_pending' }
  | { kind: 'preview'; bootstrap: Opening }
  | { kind: 'ready'; bootstrap: Opening; setCookie: string | null; attemptProgress: {
      strikeCount: 0; completedAtBats: readonly [];
    } };

/**
 * Private first attempt reservation. No HTTP call site. The creator marker is
 * reserved for future v2 issuance and must be set on the same creating browser.
 * This marker is not a replacement for future account/competition abuse review.
 */
export function createServerCustomLineupV2AttemptBootstrap({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Record<string, string | undefined>; dependencies?: Dependencies } = {}) {
  return {
    async bootstrap(puzzleId: unknown, cookieHeader: string | null, requestUrl: string): Promise<Result> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomLineupPuzzleId(puzzleId); } catch { return { kind: 'not_found' }; }
      const secret = dependencies.getSecret(environment);
      const creators = createCustomLineupV2CreatorBrowserMarker(secret);
      const credentials = createCustomLineupV2AttemptBrowserCredential(secret);
      const creator = creators.inspect(cookieHeader, puzzleId);
      const inspected = credentials.inspect(cookieHeader, puzzleId);
      if (creator === 'invalid' || inspected.kind === 'invalid') return { kind: 'invalid_credential' };

      const opening = await dependencies.opening(puzzleId, environment);
      if (opening === null) return { kind: 'not_found' };
      const length = opening.atBats.length;
      if (opening.puzzleId !== puzzleId || opening.rulesetVersion !== 'points-v4'
        || length < 1 || length > 10
        || opening.atBats.some((ab, i) => ab.pitchNumber !== i + 1)
        || opening.hintBundle.pitchNumber !== 1 || opening.hintBundle.revealedCount !== 0) {
        throw new Error('Invalid Custom v2 issued opening.');
      }
      const tokens = createCustomLineupV2ProgressionTokens(secret);
      const openingClaims = tokens.verify(opening.progressionToken);
      if (openingClaims.version !== 1 || openingClaims.puzzleId !== puzzleId
        || openingClaims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
        || openingClaims.rulesetVersion !== 'points-v4'
        || openingClaims.pitchNumber !== 1 || openingClaims.completed
        || openingClaims.revealCount !== 0 || openingClaims.strikeCount !== 0 || openingClaims.outCount !== 0) {
        throw new Error('Invalid Custom v2 initial progression.');
      }
      const redacted: Opening = {
        ...opening, hintBundle: projectCustomNineAttemptHintBundle(opening.hintBundle),
      };
      if (creator === 'creator') return { kind: 'preview', bootstrap: redacted };

      const repo = dependencies.repository(environment, length);
      const issued = inspected.kind === 'absent' ? credentials.issue(puzzleId, requestUrl) : null;
      const key = {
        challengeId: puzzleId,
        browserKeyDigest: issued?.browserKeyDigest
          ?? (inspected.kind === 'valid' ? inspected.browserKeyDigest : ''),
      };
      const saved: CustomNineAttemptState | null = issued === null
        ? await repo.getByKey(key)
        : (await repo.getOrCreate(key, opening.progressionToken)).state;
      if (saved === null) return { kind: 'invalid_credential' };
      if (saved.challengeId !== puzzleId || saved.browserKeyDigest !== key.browserKeyDigest) {
        throw new Error('Custom v2 saved attempt identity mismatch.');
      }
      const claims = tokens.verify(saved.currentProgressionToken);
      if (claims.puzzleId !== puzzleId || claims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
        || claims.rulesetVersion !== 'points-v4'
        || claims.pitchNumber < 1 || claims.pitchNumber > length
        || claims.completed !== (saved.status === 'completed')) {
        throw new Error('Custom v2 persisted progression scope mismatch.');
      }
      if (saved.status === 'completed') return { kind: 'completed' };
      if (saved.revision !== 0 || saved.terminalAtBats.length !== 0
        || saved.currentProgressionToken !== opening.progressionToken) {
        // A later separately reviewed service will rehydrate saved hints/facts.
        // Never reset the signed monotonic progression or reserve another row.
        return { kind: 'continuation_pending' };
      }
      return {
        kind: 'ready', bootstrap: redacted, setCookie: issued?.setCookie ?? null,
        attemptProgress: { strikeCount: 0, completedAtBats: [] },
      };
    },
  };
}
