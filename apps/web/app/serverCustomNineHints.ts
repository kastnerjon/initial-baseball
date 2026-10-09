import 'server-only';
import {
  createCustomNineIssuedChallengeService,
  validateCustomNinePuzzleId,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { Player } from '@initial-baseball/shared';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalDailyPlayer } from './canonicalDailyPlayerLookup';
import { getCanonicalRevealReader, getCanonicalRuntime } from './serverCanonicalData';
import { DailyProgressionTokenError } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { DailyRuntimeRequestError, createDailyRuntimeService } from './dailyRuntimeService';
import type { DailyResolutionRequest } from './dailyRuntimeContracts';
import {
  CUSTOM_NINE_SESSION_DATE,
  createCustomNineProgressionTokens,
  materializeCustomNineSessionPuzzle,
} from './serverCustomNineBootstrap';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';

export class CustomNineHintRequestError extends Error {
  constructor() {
    super('Invalid Custom Nine progression request.');
    this.name = 'CustomNineHintRequestError';
  }
}

type Dependencies = {
  createSupabaseClient: (env: Record<string, string | undefined>) => SupabaseClient;
  createRepository: (client: SupabaseClient) => CustomNineIssuedChallengeRepository;
  resolvePlayer: (id: string) => Player | null;
  resolveLegacyPlayerId: (id: string) => string;
  getCanonicalReveal: (id: string) => CanonicalPlayerReveal;
  getProgressionSecret: (env: Record<string, string | undefined>) => string;
};

const DEFAULT_DEPENDENCIES: Dependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseCustomNineIssuedChallengeRepository,
  resolvePlayer: getCanonicalDailyPlayer,
  resolveLegacyPlayerId: id => getCanonicalRuntime().requireCanonicalPlayerId(id),
  getCanonicalReveal: id => getCanonicalRevealReader().getReveal(id),
  getProgressionSecret: getDailyProgressionSecret,
};

export function createServerCustomNineHintService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: Dependencies;
} = {}) {
  async function authorizedRuntime(puzzleId: unknown, token: unknown) {
    if (typeof puzzleId !== 'string') return null;
    try { validateCustomNinePuzzleId(puzzleId); } catch { return null; }

    if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
      throw new CustomNineHintRequestError();
    }
    const tokens = createCustomNineProgressionTokens(dependencies.getProgressionSecret(environment));
    let claims;
    try {
      claims = tokens.verify(token);
    } catch (error) {
      if (error instanceof DailyProgressionTokenError) throw new CustomNineHintRequestError();
      throw error;
    }
    if (
      claims.puzzleId !== puzzleId
      || claims.puzzleDate !== CUSTOM_NINE_SESSION_DATE
      || claims.rulesetVersion !== 'points-v4'
      || claims.completed
    ) throw new CustomNineHintRequestError();

    const repository = dependencies.createRepository(dependencies.createSupabaseClient(environment));
    const challenge = await createCustomNineIssuedChallengeService(repository).getById(puzzleId);
    if (challenge === null) return null;
    if (challenge.rulesetVersion !== claims.rulesetVersion) throw new CustomNineHintRequestError();

    // This is the same frozen, server-only puzzle used by opening bootstrap.
    const puzzle = materializeCustomNineSessionPuzzle(challenge, dependencies.resolvePlayer);
    return createDailyRuntimeService({
      createPuzzle: date => {
        if (date !== CUSTOM_NINE_SESSION_DATE) throw new CustomNineHintRequestError();
        return puzzle;
      },
      progressionTokens: tokens,
      resolveLegacyPlayerId: id => dependencies.resolveLegacyPlayerId(id),
      getCanonicalReveal: id => {
        const reveal = dependencies.getCanonicalReveal(id);
        if (reveal.playerId !== id) throw new Error('Canonical reveal identity mismatch.');
        return reveal;
      },
    });
  }

  async function execute<T>(
    puzzleId: unknown,
    token: unknown,
    action: (runtime: ReturnType<typeof createDailyRuntimeService>, signedToken: string) => Promise<T>,
  ): Promise<T | null> {
    const runtime = await authorizedRuntime(puzzleId, token);
    if (runtime === null) return null;
    try {
      return await action(runtime, token as string);
    } catch (error) {
      if (error instanceof DailyRuntimeRequestError) throw new CustomNineHintRequestError();
      throw error;
    }
  }

  return {
    getHintBundle: (id: unknown, token: unknown) =>
      execute(id, token, (runtime, value) => runtime.getHintBundle(value)),
    revealHint: (id: unknown, token: unknown) =>
      execute(id, token, (runtime, value) => runtime.revealHint(value)),
    resolveAtBat: (id: unknown, request: DailyResolutionRequest) =>
      execute(id, request.progressionToken, (runtime, value) =>
        runtime.resolveAtBat({ ...request, progressionToken: value })),

  };
}
