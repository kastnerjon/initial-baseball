import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  createCustomNineIssuedChallengeService,
  createCustomNineLineupSelection,
  type CustomNineIssuedChallengeRepository,
  type PermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { materializeCustomNineIssuedClueSnapshot } from './materializeCustomNineIssuedClueSnapshot';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomNineIssuedChallengeRepository } from './supabaseCustomNineIssuedChallengeRepository';

export type ServerCustomNineCreationErrorKind = 'invalid_selection' | 'unsupported_players' | 'immutable_conflict';

export class ServerCustomNineCreationError extends Error {
  constructor(readonly kind: ServerCustomNineCreationErrorKind) {
    super('Custom Nine challenge creation could not be completed.');
    this.name = 'ServerCustomNineCreationError';
  }
}

interface CustomNineCreationDependencies {
  createSupabaseClient: (environment: Record<string, string | undefined>) => SupabaseClient;
  createRepository: (client: SupabaseClient) => CustomNineIssuedChallengeRepository;
  materializeClues: (playerIds: readonly string[]) => PermanentDailyIssuedClueSnapshot;
  mintUuid: () => string;
  issuedAt: () => string;
}

const DEFAULT_DEPENDENCIES: CustomNineCreationDependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseCustomNineIssuedChallengeRepository,
  materializeClues: materializeCustomNineIssuedClueSnapshot,
  mintUuid: randomUUID,
  issuedAt: () => new Date().toISOString(),
};

export function createServerCustomNineCreationService({
  environment = process.env,
  dependencies = DEFAULT_DEPENDENCIES,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: CustomNineCreationDependencies;
} = {}) {
  return {
    /** Private issuance; never return the answer-bearing record to an HTTP caller. */
    async issue(payload: unknown): Promise<{ puzzleId: string }> {
      const selection = readSelection(payload);
      let clueSnapshot: PermanentDailyIssuedClueSnapshot;
      try {
        clueSnapshot = dependencies.materializeClues(selection.canonicalPlayerIds);
      } catch {
        // Canonical lookup errors may contain private player IDs and future hints.
        throw new ServerCustomNineCreationError('unsupported_players');
      }

      const challengeService = createCustomNineIssuedChallengeService(
        dependencies.createRepository(dependencies.createSupabaseClient(environment)),
      );
      const result = await challengeService.issue({
        puzzleId: `custom-nine-v1-${dependencies.mintUuid()}`,
        canonicalPlayerIds: selection.canonicalPlayerIds,
        clueSnapshot,
        issuedAt: dependencies.issuedAt(),
      });
      if (!result.ok) throw new ServerCustomNineCreationError('immutable_conflict');
      return { puzzleId: result.challenge.puzzleId };
    },
  };
}

function readSelection(payload: unknown) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).length !== 1
    || !Object.prototype.hasOwnProperty.call(payload, 'canonicalPlayerIds')) {
    throw new ServerCustomNineCreationError('invalid_selection');
  }
  const ids = (payload as { canonicalPlayerIds: unknown }).canonicalPlayerIds;
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) {
    throw new ServerCustomNineCreationError('invalid_selection');
  }
  try {
    return createCustomNineLineupSelection(ids as string[]);
  } catch {
    throw new ServerCustomNineCreationError('invalid_selection');
  }
}
