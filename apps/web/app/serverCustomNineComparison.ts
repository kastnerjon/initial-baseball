import 'server-only';
import {
  createCustomNineIssuedChallengeService,
  createDailyNineComparisonService,
  validateCustomNinePuzzleId,
} from '@initial-baseball/daily';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { inspectCustomNineAttemptEligibility } from './customNineAttemptEligibility';
import type { CustomNineAttemptState } from './customNineAttemptRowCodec';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';
import { createSupabaseCustomNineComparisonRepository } from './supabaseCustomNineComparisonRepository';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';

type Environment = Record<string, string | undefined>;
type PeerComparison = Awaited<ReturnType<typeof readPeers>>;
type Dependencies = {
  getSecret: (environment: Environment) => string;
  challengeExists: (puzzleId: string, environment: Environment) => Promise<boolean>;
  getAttempt: (puzzleId: string, digest: string, environment: Environment) => Promise<CustomNineAttemptState | null>;
  hasAcceptedResult: (puzzleId: string, attemptId: string, environment: Environment) => Promise<boolean>;
  readPeers: (puzzleId: string, trustedAttemptId: string, environment: Environment) => Promise<PeerComparison>;
};

/** No player IDs, clues, terminal facts, cookies, or submission identifiers in this projection. */
async function readPeers(puzzleId: string, trustedAttemptId: string, environment: Environment) {
  const repository = createSupabaseCustomNineComparisonRepository(
    createServerSupabaseClient(environment), trustedAttemptId,
  );
  const comparison = createDailyNineComparisonService(repository);
  const key = {
    puzzleId,
    puzzleDate: CUSTOM_NINE_SESSION_DATE,
    puzzleNumber: 1,
    rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
  } as const;
  const [completed, ...atBats] = await Promise.all([
    comparison.getCompletedGames(key),
    ...Array.from({ length: 9 }, (_, index) =>
      comparison.getAtBat({ ...key, pitchNumber: index + 1 })),
  ]);
  return {
    completed: {
      completedGameCount: completed.completedGameCount,
      averageTotalPoints: completed.averageTotalPoints,
      scoreHistogram: completed.scoreHistogram,
    },
    atBats: atBats.map((bat, index) => ({
      pitchNumber: index + 1,
      resolvedAtBatCount: bat.resolvedAtBatCount,
      averagePoints: bat.averagePoints,
      scoreHistogram: bat.scoreHistogram,
    })),
  };
}

const DEFAULT: Dependencies = {
  getSecret: getDailyProgressionSecret,
  challengeExists: async (id, environment) => {
    const service = createCustomNineIssuedChallengeService(
      createSupabaseCustomNineIssuedChallengeRepository(createServerSupabaseClient(environment)),
    );
    const challenge = await service.getById(id);
    if (challenge === null) return false;
    if (challenge.puzzleId !== id
      || challenge.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
      || challenge.clueSnapshot.pitches.length !== 9) {
      throw new Error('Private Custom Nine challenge identity mismatch.');
    }
    return true;
  },
  getAttempt: (id, digest, environment) => createSupabaseCustomNineAttemptRepository(
    createServerSupabaseClient(environment),
  ).getByKey({ challengeId: id, browserKeyDigest: digest }),
  hasAcceptedResult: async (id, attemptId, environment) => {
    // An ended ledger alone is not proof of an admitted first result. Never
    // read the comparison cohort until the exact server-owned submission has
    // been durably accepted for this challenge and fixed points-v4 ruleset.
    const { data, error } = await createServerSupabaseClient(environment)
      .from('custom_nine_completed_results')
      .select('submission_id')
      .match({
        submission_id: attemptId,
        challenge_id: id,
        schema_version: 1,
        ruleset_version: POINTS_V4_DAILY_RULESET_VERSION,
      })
      .maybeSingle();
    if (error !== null) throw new Error('Custom Nine accepted-result lookup unavailable.');
    if (data === null) return false;
    if (data.submission_id !== attemptId) {
      throw new Error('Private Custom Nine accepted-result identity mismatch.');
    }
    return true;
  },
  readPeers,
};

export type CustomNineComparisonResult =
  | { kind: 'not_found' | 'ineligible' | 'incomplete' | 'not_admitted' }
  | ({ kind: 'ready' } & PeerComparison);

/**
 * Private, server-only comparison composition. A challenge URL alone does
 * not qualify a participant. Only a verified signed browser credential
 * resolving to its completed immutable server ledger may select the
 * first-attempt UUID excluded from private score-bucket RPCs.
 *
 * This module has no HTTP route or public browser transport.
 */
export function createServerCustomNineComparisonService({
  environment = process.env,
  dependencies = DEFAULT,
}: { environment?: Environment; dependencies?: Dependencies } = {}) {
  return {
    async read(puzzleId: unknown, cookieHeader: string | null): Promise<CustomNineComparisonResult> {
      if (typeof puzzleId !== 'string') return { kind: 'not_found' };
      try { validateCustomNinePuzzleId(puzzleId); }
      catch { return { kind: 'not_found' }; }

      const secret = dependencies.getSecret(environment);
      const eligibility = inspectCustomNineAttemptEligibility(secret, cookieHeader, puzzleId);
      if (eligibility.kind !== 'valid') return { kind: 'ineligible' };
      if (!await dependencies.challengeExists(puzzleId, environment)) return { kind: 'not_found' };

      const attempt = await dependencies.getAttempt(
        puzzleId, eligibility.browserKeyDigest, environment,
      );
      if (attempt === null || attempt.challengeId !== puzzleId
        || attempt.browserKeyDigest !== eligibility.browserKeyDigest) return { kind: 'ineligible' };
      if (attempt.status !== 'completed' || attempt.terminalAtBats.length !== 9
        || attempt.completedAt === null) return { kind: 'incomplete' };

      if (!await dependencies.hasAcceptedResult(puzzleId, attempt.attemptId, environment)) {
        return { kind: 'not_admitted' };
      }
      const peers = await dependencies.readPeers(puzzleId, attempt.attemptId, environment);
      return { kind: 'ready', ...peers };
    },
  };
}
