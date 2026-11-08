import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import { createCustomLineupV2AttemptBrowserCredential } from './customNineAttemptBrowserCredential';
import { createCustomLineupV2CreatorBrowserMarker } from './customNineCreatorBrowser';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createServerSupabaseClient } from './serverSupabaseClient';
import {
  createSupabaseCustomV2CompletionDisplayRepository,
  type CustomV2CompletionDisplayChoice,
  type CustomV2CompletionDisplayWrite,
  type CustomV2CompletionDisplayRead,
} from './supabaseCustomV2CompletionDisplayRepository';

type Environment = Record<string, string | undefined>;
type Dependencies = {
  getSecret: (env: Environment) => string;
  write: (input: CustomV2CompletionDisplayWrite, env: Environment) =>
    Promise<'created' | 'existing' | 'conflict'>;
  read: (input: CustomV2CompletionDisplayRead, env: Environment) =>
    Promise<CustomV2CompletionDisplayChoice | null>;
};
const DEFAULT: Dependencies = {
  getSecret: getDailyProgressionSecret,
  write: (input, env) =>
    createSupabaseCustomV2CompletionDisplayRepository(createServerSupabaseClient(env))
      .write(input),
  read: (input, env) =>
    createSupabaseCustomV2CompletionDisplayRepository(createServerSupabaseClient(env))
      .read(input),
};

export type CustomV2CompletionDisplayOutcome =
  | Readonly<{ kind: 'disabled' | 'invalid' | 'unauthorized' | 'unavailable' | 'conflict' }>
  | Readonly<{ kind: 'saved'; status: 'created' | 'existing' }>;

export type CustomV2CompletionDisplayReadOutcome =
  | Readonly<{ kind: 'disabled' | 'invalid' | 'unauthorized' | 'unavailable' }>
  | Readonly<{ kind: 'loaded'; choice: CustomV2CompletionDisplayChoice | null }>;

function parseChoice(value: unknown): CustomV2CompletionDisplayChoice | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const choice = value as Record<string, unknown>;
  const keys = Object.keys(choice);
  if (choice.mode === 'anonymous') {
    if (!keys.every(key => key === 'mode' || key === 'displayName')
      || keys.length < 1 || keys.length > 2 || choice.displayName != null) return null;
    return { mode: 'anonymous', displayName: null };
  }
  if (choice.mode === 'named' && keys.length === 2
    && keys.includes('mode') && keys.includes('displayName')) {
    const parsed = parseCompletionDisplayName(choice.displayName);
    return parsed.ok ? { mode: 'named', displayName: parsed.displayName } : null;
  }
  return null;
}

function inspectAuthenticatedBrowser(
  puzzleId: string, cookieHeader: string | null, secret: string,
): string | null {
  const creator = createCustomLineupV2CreatorBrowserMarker(secret)
    .inspect(cookieHeader, puzzleId);
  const browser = createCustomLineupV2AttemptBrowserCredential(secret)
    .inspect(cookieHeader, puzzleId);
  return creator === 'unmarked' && browser.kind === 'valid'
    ? browser.browserKeyDigest : null;
}

/**
 * Source-staged Custom #528 private write/readback boundary. This service has no route
 * or public reader. Browser-only input is the exact puzzle cookie and optional
 * display choice; all result identity, eligibility and first-write-wins authority
 * remain with the separate, service-role-only database RPC.
 */
export function createServerCustomV2CompletionDisplayService({
  environment = process.env, dependencies = DEFAULT,
}: { environment?: Environment; dependencies?: Dependencies } = {}) {
  return {
    async write(puzzleId: unknown, cookieHeader: string | null, rawChoice: unknown):
      Promise<CustomV2CompletionDisplayOutcome> {
      // This is a new independent release gate, never inferred from Custom gameplay.
      if (environment.CUSTOM_V2_COMPLETION_DISPLAY_ENABLED !== 'true') {
        return { kind: 'disabled' };
      }
      if (typeof puzzleId !== 'string') return { kind: 'invalid' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'invalid' }; }

      let choice: CustomV2CompletionDisplayChoice | null;
      try { choice = parseChoice(rawChoice); }
      catch { return { kind: 'invalid' }; }
      if (choice === null) return { kind: 'invalid' };

      try {
        const secret = dependencies.getSecret(environment);
        const digest = inspectAuthenticatedBrowser(puzzleId, cookieHeader, secret);
        // SQL separately checks the durable monotonic creator_seen marker.
        if (digest === null) return { kind: 'unauthorized' };
        const status = await dependencies.write({
          puzzleId, browserKeyDigest: digest, choice,
        }, environment);
        if (status === 'conflict') return { kind: 'conflict' };
        if (status !== 'created' && status !== 'existing') return { kind: 'unavailable' };
        return { kind: 'saved', status };
      } catch {
        return { kind: 'unavailable' };
      }
    },

    /** Scoped refresh read, never a public leaderboard or account profile lookup. */
    async read(puzzleId: unknown, cookieHeader: string | null):
      Promise<CustomV2CompletionDisplayReadOutcome> {
      if (environment.CUSTOM_V2_COMPLETION_DISPLAY_ENABLED !== 'true') {
        return { kind: 'disabled' };
      }
      if (typeof puzzleId !== 'string') return { kind: 'invalid' };
      try { validateCustomLineupPuzzleId(puzzleId); }
      catch { return { kind: 'invalid' }; }

      try {
        const secret = dependencies.getSecret(environment);
        const digest = inspectAuthenticatedBrowser(puzzleId, cookieHeader, secret);
        if (digest === null) return { kind: 'unauthorized' };
        const choice = await dependencies.read({
          puzzleId, browserKeyDigest: digest,
        }, environment);
        return { kind: 'loaded', choice };
      } catch {
        return { kind: 'unavailable' };
      }
    },
  };
}
