import 'server-only';
import { cloneCustomLineupIssuedChallenge, validateCustomLineupPuzzleId,
  type CustomLineupIssuedChallenge } from '@initial-baseball/daily';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import type { DailyProgressionClaims } from './dailyProgressionToken';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import {
  createCustomLineupV2ProgressionTokens, createServerCustomLineupV2BootstrapService,
} from './serverCustomLineupV2Bootstrap';
import { projectCustomNineAttemptHintBundle } from './serverCustomNineAttemptBootstrap';
import { validCustomLineupV2SavedHistory } from './serverCustomLineupV2AttemptHints';
import { createSupabaseCustomLineupV2IssuedReader } from './supabaseCustomLineupV2IssuedReader';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomLineupV2ReservationRepository } from './supabaseCustomLineupV2ReservationRepository';

type Opening = NonNullable<Awaited<ReturnType<ReturnType<typeof createServerCustomLineupV2BootstrapService>['bootstrap']>>>;
type Ledger = Pick<ReturnType<typeof createSupabaseCustomLineupV2ReservationRepository>,
  'getByKey' | 'getOrCreate'>;
type Dependencies = {
  opening: (id: string, env: Record<string, string | undefined>) => Promise<Opening | null>;
  repository: (env: Record<string, string | undefined>, n: number) => Ledger;
  readChallenge: (id: string, env: Record<string, string | undefined>) => Promise<CustomLineupIssuedChallenge | null>;
  getSecret: (env: Record<string, string | undefined>) => string;
};
const DEFAULT: Dependencies = {
  opening: (id, env) => createServerCustomLineupV2BootstrapService({ environment: env }).bootstrap(id),
  repository: (env, n) => createSupabaseCustomLineupV2ReservationRepository(createServerSupabaseClient(env), n),
  readChallenge: (id, env) =>
    createSupabaseCustomLineupV2IssuedReader(createServerSupabaseClient(env)).getById(id),
  getSecret: getDailyProgressionSecret,
};
export type CustomLineupV2AttemptProgress = Readonly<{
  strikeCount: DailyProgressionClaims['strikeCount'];
  completedAtBats: readonly DailyCompletedAtBat[];
}>;
type Result =
  | { kind: 'not_found' | 'invalid_credential' }
  | { kind: 'completed'; atBats: Opening['atBats'];
      completedAtBats: readonly DailyCompletedAtBat[]; revision: number; completedAt: string }
  | { kind: 'preview'; bootstrap: Opening }
  | { kind: 'ready'; bootstrap: Opening; setCookie: string | null;
      attemptProgress: CustomLineupV2AttemptProgress };

/**
 * Private first-attempt reservation and durable, read-only continuation.
 * Never reset an existing credential to pitch one. No public HTTP call site,
 * result admission or competition activation; creators never reserve attempts.
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
      if (saved.creatorSeen === true) return { kind: 'preview', bootstrap: redacted };
      if (saved.challengeId !== puzzleId || saved.browserKeyDigest !== key.browserKeyDigest) {
        throw new Error('Custom v2 saved attempt identity mismatch.');
      }
      const claims = tokens.verify(saved.currentProgressionToken);
      if (claims.version !== 1 || claims.puzzleId !== puzzleId
        || claims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
        || claims.rulesetVersion !== 'points-v4'
        || claims.pitchNumber < 1 || claims.pitchNumber > length
        || claims.completed !== (saved.status === 'completed')) {
        throw new Error('Custom v2 persisted progression scope mismatch.');
      }
      if (saved.status === 'active' && saved.revision === 0
        && saved.terminalAtBats.length === 0
        && saved.currentProgressionToken === opening.progressionToken) {
        return {
          kind: 'ready', bootstrap: redacted, setCookie: issued?.setCookie ?? null,
          attemptProgress: { strikeCount: 0, completedAtBats: [] },
        };
      }

      // Read the frozen challenge only for saved progress. Neither the issued
      // answers nor unused hints may cross the private bootstrap boundary.
      const row = await dependencies.readChallenge(puzzleId, environment);
      if (row === null) throw new Error('Custom v2 saved challenge unavailable.');
      const challenge = cloneCustomLineupIssuedChallenge(row);
      if (challenge.puzzleId !== puzzleId || challenge.canonicalPlayerIds.length !== length
        || challenge.clueSnapshot.pitches.some((pitch, index) =>
          pitch.pitchNumber !== opening.atBats[index]?.pitchNumber
          || pitch.initials !== opening.atBats[index]?.initials)
        || !validCustomLineupV2SavedHistory(saved, claims, challenge)) {
        throw new Error('Custom v2 saved attempt history mismatch.');
      }

      const completedAtBats = saved.terminalAtBats.map(fact => ({ ...fact }));
      if (saved.status === 'completed') {
        if (saved.completedAt === null) throw new Error('Custom v2 completion timestamp missing.');
        return {
          kind: 'completed', atBats: redacted.atBats,
          completedAtBats, revision: saved.revision, completedAt: saved.completedAt,
        };
      }

      const active = challenge.clueSnapshot.pitches[claims.pitchNumber - 1];
      if (!active) throw new Error('Custom v2 active batter unavailable.');
      const revealedHints: Opening['hintBundle']['hints'] =
        challenge.clueSnapshot.hintLayout.flatMap((slot, index) => {
          if (slot.slot > claims.revealCount) return [];
          const value = active.hintValues[index];
          if (value === undefined) throw new Error('Custom v2 frozen hint unavailable.');
          return [{
            slot: slot.slot, hintType: slot.hintType,
            hintLabel: slot.displayLabel, hintValue: value,
          }];
        });
      return {
        kind: 'ready', setCookie: null,
        bootstrap: {
          ...redacted, progressionToken: saved.currentProgressionToken,
          hintBundle: {
            pitchNumber: claims.pitchNumber, revealedCount: claims.revealCount,
            hints: revealedHints, checkpoints: [],
          },
        },
        attemptProgress: { strikeCount: claims.strikeCount, completedAtBats },
      };
    },
  };
}
