import 'server-only';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';
import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import type { DailyProgressionClaims } from './dailyProgressionToken';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import type { CustomNineBootstrapResponse } from './serverCustomNineBootstrap';
import { createServerCustomNineBootstrapService } from './serverCustomNineBootstrap';
import { createServerCustomNineHintService } from './serverCustomNineHints';
import { createCustomNineAttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { inspectCustomNineAttemptEligibility } from './customNineAttemptEligibility';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';

type Ledger = Pick<ReturnType<typeof createSupabaseCustomNineAttemptRepository>,
  'getByKey' | 'getOrCreate'>;

type Dependencies = {
  bootstrap: (id: string) => Promise<CustomNineBootstrapResponse | null>;
  restore: (id: string, token: string) =>
    Promise<{ hintBundle: CustomNineBootstrapResponse['hintBundle'] } | null>;
  attemptRepository: (environment: Record<string, string | undefined>) => Ledger;
  getSecret: (environment: Record<string, string | undefined>) => string;
};

const DEFAULT_DEPENDENCIES: Dependencies = {
  bootstrap: id => createServerCustomNineBootstrapService().bootstrap(id),
  restore: (id, token) => createServerCustomNineHintService().getHintBundle(id, token),
  attemptRepository: env => createSupabaseCustomNineAttemptRepository(createServerSupabaseClient(env)),
  getSecret: getDailyProgressionSecret,
};

type Result =
  | { kind: 'not_found' | 'invalid_credential' | 'completed' }
  | { kind: 'preview'; bootstrap: CustomNineBootstrapResponse }
  | { kind: 'ready'; bootstrap: CustomNineBootstrapResponse; setCookie: string | null;
      attemptProgress: CustomNineAttemptProgress };

export type CustomNineAttemptProgress = Readonly<{
  strikeCount: DailyProgressionClaims['strikeCount'];
  completedAtBats: readonly DailyCompletedAtBat[];
}>;

/**
 * Staged, opt-in Custom Nine POST only. Old stateless GET/hints/resolve routes
 * remain unchanged and are NOT eligible evidence for competitive results.
 * This performs no scored transitions or result submissions.
 */
export function createServerCustomNineAttemptBootstrap({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: Dependencies;
} = {}) {
  return {
    async bootstrap(puzzleId: unknown, cookieHeader: string | null, requestUrl: string): Promise<Result> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomNinePuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }

      const secret = dependencies.getSecret(environment);
      const eligible = inspectCustomNineAttemptEligibility(secret, cookieHeader, puzzleId);
      const credential = createCustomNineAttemptBrowserCredential(secret);
      if (eligible.kind === 'invalid') return { kind: 'invalid_credential' };

      const bootstrap = await dependencies.bootstrap(puzzleId);
      if (bootstrap === null) return { kind: 'not_found' };
      if (bootstrap.puzzleId !== puzzleId || bootstrap.rulesetVersion !== 'points-v4') {
        throw new Error('Custom Nine bootstrap identity mismatch.');
      }
      if (eligible.kind === 'creator') return { kind: 'preview', bootstrap };

      const repo = dependencies.attemptRepository(environment);
      const issued = eligible.kind === 'absent' ? credential.issue(puzzleId, requestUrl) : null;
      const key = {
        challengeId: puzzleId,
        browserKeyDigest: issued?.browserKeyDigest ?? (eligible.kind === 'valid' ? eligible.browserKeyDigest : ''),
      };
      const saved = issued === null
        ? await repo.getByKey(key)
        : (await repo.getOrCreate(key, bootstrap.progressionToken)).state;
      // A valid but no-longer-stored credential cannot reserve another attempt.
      if (saved === null) return { kind: 'invalid_credential' };
      if (saved.status === 'completed') return { kind: 'completed' };
      if (saved.challengeId !== puzzleId || saved.browserKeyDigest !== key.browserKeyDigest) {
        throw new Error('Custom Nine saved attempt identity mismatch.');
      }

      let response = bootstrap;
      if (saved.currentProgressionToken !== bootstrap.progressionToken) {
        // A future server-authoritative transition may already have advanced.
        // Restore exactly its signed active batter; do not reset to pitch one.
        const restored = await dependencies.restore(puzzleId, saved.currentProgressionToken);
        if (restored === null) throw new Error('Custom Nine stored continuation unavailable.');
        response = {
          ...bootstrap,
          progressionToken: saved.currentProgressionToken,
          hintBundle: restored.hintBundle,
        };
      }
      const progress = verifyCustomNineAttemptProgress(
        saved, response, createCustomNineProgressionTokens(secret).verify(saved.currentProgressionToken),
      );
      return {
        kind: 'ready', bootstrap: projectCustomNineAttemptBootstrap(response),
        attemptProgress: progress, setCookie: issued?.setCookie ?? null,
      };
    },
  };
}

/**
 * Only already-authorized hint depths are returned on the stateful attempt
 * protocol. The legacy stateless Custom bootstrap intentionally retains its
 * prior bundle semantics and is NOT admissible as competitive evidence.
 */
export function projectCustomNineAttemptHintBundle(bundle: CustomNineBootstrapResponse['hintBundle']) {
  if (!Number.isInteger(bundle.revealedCount) || bundle.revealedCount < 0 || bundle.revealedCount > 4) {
    throw new Error('Invalid Custom Nine authorized hint depth.');
  }
  return {
    ...bundle,
    hints: bundle.hints.filter(hint => hint.slot <= bundle.revealedCount),
    checkpoints: [],
  };
}

export function projectCustomNineAttemptBootstrap(
  result: CustomNineBootstrapResponse,
): CustomNineBootstrapResponse {
  return { ...result, hintBundle: projectCustomNineAttemptHintBundle(result.hintBundle) };
}


/** Rehydrate only already-terminal results and current strikes from the signed,
 * server-monotonic attempt. This never returns future-batter answers or hints.
 */
function verifyCustomNineAttemptProgress(
  saved: CustomNineAttemptState,
  response: CustomNineBootstrapResponse,
  claims: DailyProgressionClaims,
): CustomNineAttemptProgress {
  const facts = saved.terminalAtBats;
  if (saved.status !== 'active' || claims.version !== 1 || claims.completed
    || claims.puzzleId !== response.puzzleId || claims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
    || claims.rulesetVersion !== response.rulesetVersion
    || claims.pitchNumber !== facts.length + 1 || facts.length >= 9
    || response.hintBundle.pitchNumber !== claims.pitchNumber
    || response.hintBundle.revealedCount !== claims.revealCount
    || response.atBats.length !== 9) {
    throw new Error('Custom Nine saved attempt progression mismatch.');
  }
  for (const [index, fact] of facts.entries()) {
    const expected = response.atBats[index];
    if (expected?.pitchNumber !== index + 1 || expected.initials !== fact.initials
      || fact.pitchNumber !== index + 1
      || !normalizeDailyTerminalAtBat(fact, expected).ok) {
      throw new Error('Custom Nine saved terminal facts mismatch.');
    }
  }
  // Each prior batter used one terminal CAS plus one CAS per exposed hint
  // and nonterminal wrong guess. A third-strike terminal CAS itself records
  // the third wrong guess; Give Up is terminal with the actual prior strikes.
  const priorRevisions = facts.reduce((total, fact) => total
    + fact.hintsRevealed
    + (fact.resolution === 'strikeout' ? 2 : fact.wrongGuesses) + 1, 0);
  if (saved.revision !== priorRevisions + claims.revealCount + claims.strikeCount) {
    throw new Error('Custom Nine saved attempt revision mismatch.');
  }
  const outs = facts.filter(fact => fact.outcome === 'K').length;
  if (claims.outCount !== Math.min(3, outs)) {
    throw new Error('Custom Nine saved out progression mismatch.');
  }
  return {
    strikeCount: claims.strikeCount,
    completedAtBats: facts.map(fact => ({ ...fact })),
  };
}
