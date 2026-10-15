import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  createCustomLineupIssuedChallenge,
  createCustomLineupSelection,
  type CustomLineupIssuedChallenge,
  type PermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { materializeCustomLineupV2IssuedClueSnapshot } from './materializePermanentDailyIssuedClueSnapshot';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseCustomLineupV2IssuedWriter } from './supabaseCustomLineupV2IssuedWriter';

export type ServerCustomLineupV2CreationErrorKind =
  'invalid_selection' | 'unsupported_players' | 'immutable_conflict';

export class ServerCustomLineupV2CreationError extends Error {
  constructor(readonly kind: ServerCustomLineupV2CreationErrorKind) {
    super('Private Custom Lineup v2 issuance could not be completed.');
    this.name = 'ServerCustomLineupV2CreationError';
  }
}

type IssuedRepository = Pick<ReturnType<typeof createSupabaseCustomLineupV2IssuedWriter>, 'insertIfAbsent'>;
interface Dependencies {
  createSupabaseClient: (env: Record<string, string | undefined>) => SupabaseClient;
  createRepository: (client: SupabaseClient) => IssuedRepository;
  materializeClues: (ids: readonly string[]) => PermanentDailyIssuedClueSnapshot;
  mintUuid: () => string;
  issuedAt: () => string;
}
const DEFAULT: Dependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseCustomLineupV2IssuedWriter,
  materializeClues: materializeCustomLineupV2IssuedClueSnapshot,
  mintUuid: randomUUID,
  issuedAt: () => new Date().toISOString(),
};

/**
 * Private service only. The future admin HTTP boundary must check authorization,
 * same-origin and signing configuration BEFORE calling issue. Never return a clue.
 */
export function createServerCustomLineupV2CreationService({
  environment = process.env,
  dependencies = DEFAULT,
}: {
  environment?: Record<string, string | undefined>;
  dependencies?: Dependencies;
} = {}) {
  return {
    async issue(payload: unknown): Promise<{ puzzleId: string }> {
      const ids = readSelection(payload);
      let requested: CustomLineupIssuedChallenge;
      try {
        const clueSnapshot = dependencies.materializeClues(ids);
        requested = createCustomLineupIssuedChallenge({
          puzzleId: `custom-lineup-v2-${dependencies.mintUuid()}`,
          canonicalPlayerIds: ids,
          clueSnapshot,
          issuedAt: dependencies.issuedAt(),
        });
      } catch {
        // Never reflect unknown canonical player IDs or unrevealed hint contents.
        throw new ServerCustomLineupV2CreationError('unsupported_players');
      }

      const repository = dependencies.createRepository(dependencies.createSupabaseClient(environment));
      const result = await repository.insertIfAbsent(requested);
      // A UUID collision must not masquerade as successfully issued content.
      if (result.status !== 'inserted'
        || JSON.stringify(result.challenge) !== JSON.stringify(requested)) {
        throw new ServerCustomLineupV2CreationError('immutable_conflict');
      }
      return { puzzleId: requested.puzzleId };
    },
  };
}

function readSelection(payload: unknown): readonly string[] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).length !== 1
    || !Object.prototype.hasOwnProperty.call(payload, 'canonicalPlayerIds')) {
    throw new ServerCustomLineupV2CreationError('invalid_selection');
  }
  const ids = (payload as { canonicalPlayerIds: unknown }).canonicalPlayerIds;
  try {
    return createCustomLineupSelection(ids as readonly string[]).canonicalPlayerIds;
  } catch {
    throw new ServerCustomLineupV2CreationError('invalid_selection');
  }
}
