import 'server-only';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';
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
  | { kind: 'ready'; bootstrap: CustomNineBootstrapResponse; setCookie: string | null };

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
      return { kind: 'ready', bootstrap: projectCustomNineAttemptBootstrap(response), setCookie: issued?.setCookie ?? null };
    },
  };
}

/**
 * Only already-authorized hint depths are returned on the stateful attempt
 * protocol. The legacy stateless Custom bootstrap intentionally retains its
 * prior bundle semantics and is NOT admissible as competitive evidence.
 */
export function projectCustomNineAttemptBootstrap(
  result: CustomNineBootstrapResponse,
): CustomNineBootstrapResponse {
  const bundle = result.hintBundle;
  if (!Number.isInteger(bundle.revealedCount) || bundle.revealedCount < 0 || bundle.revealedCount > 4) {
    throw new Error('Invalid Custom Nine authorized hint depth.');
  }
  return {
    ...result,
    hintBundle: {
      ...bundle,
      hints: bundle.hints.filter(hint => hint.slot <= bundle.revealedCount),
      checkpoints: [],
    },
  };
}
