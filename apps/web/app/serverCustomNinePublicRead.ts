import 'server-only';
import {
  createCustomNineIssuedChallengeService,
  validateCustomNinePuzzleId,
  type CustomNineIssuedChallenge,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';

export type CustomNinePublicChallenge = Readonly<{
  puzzleId: string;
  rulesetVersion: 'points-v4';
  atBats: readonly Readonly<{ pitchNumber: number; initials: string }>[];
}>;

interface PublicReadDependencies {
  createSupabaseClient: (environment: Record<string, string | undefined>) => SupabaseClient;
  createRepository: (client: SupabaseClient) => CustomNineIssuedChallengeRepository;
}

const DEFAULT_DEPENDENCIES: PublicReadDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseCustomNineIssuedChallengeRepository,
};

/**
 * Public, *redacted* lookup only. The source record never leaves this
 * server-only module. Playable bootstrap and signed hints are separate work.
 */
export function createServerCustomNinePublicReadService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: PublicReadDependencies;
} = {}) {
  return {
    async read(puzzleId: unknown): Promise<CustomNinePublicChallenge | null> {
      if (typeof puzzleId !== 'string') return null;
      try {
        validateCustomNinePuzzleId(puzzleId);
      } catch {
        return null;
      }

      const repository = dependencies.createRepository(dependencies.createSupabaseClient(environment));
      const challenge = await createCustomNineIssuedChallengeService(repository).getById(puzzleId);
      return challenge === null ? null : toPublicChallenge(challenge);
    },
  };
}

function toPublicChallenge(challenge: CustomNineIssuedChallenge): CustomNinePublicChallenge {
  // Explicit projection, not a spread: do not serialize canonical IDs,
  // frozen clues, timestamps, player names, or answer-bearing records.
  return {
    puzzleId: challenge.puzzleId,
    rulesetVersion: challenge.rulesetVersion,
    atBats: challenge.clueSnapshot.pitches.map(pitch => ({
      pitchNumber: pitch.pitchNumber,
      initials: pitch.initials,
    })),
  };
}
