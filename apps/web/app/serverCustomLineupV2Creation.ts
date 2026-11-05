import 'server-only';
import { parseCustomLineupTitle } from '@initial-baseball/shared';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  createCustomLineupIssuedChallenge,
  createCustomLineupSelection,
  type CustomLineupIssuedChallenge,
  type CustomLineupStrikeLimit,
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
  mintOwnerCapability?: () => string;
  issuedAt: () => string;
}
const DEFAULT: Dependencies = {
  createSupabaseClient: createServerSupabaseClient,
  createRepository: createSupabaseCustomLineupV2IssuedWriter,
  materializeClues: materializeCustomLineupV2IssuedClueSnapshot,
  mintUuid: randomUUID,
  mintOwnerCapability: () => randomBytes(32).toString('base64url'),
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
  async function issueInternal(
    payload: unknown, displayTitle: string | undefined,
    ownerMode: 'none' | 'capability' | 'account', creatorAccountId?: string,
  ): Promise<{ puzzleId: string; ownerCapability: string | null }> {
      if (ownerMode === 'account' && (!creatorAccountId
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(creatorAccountId))) {
        throw new ServerCustomLineupV2CreationError('invalid_selection');
      }
      const { ids, strikeLimit } = readSelection(payload);
      // This server-owned rollout gate is independent of the public Custom/Auth flags.
      // Never issue an unplayable nondefault rule before reviewed progression is ready.
      if (strikeLimit !== 3 && (ownerMode !== 'account'
        || environment.CUSTOM_LINEUP_VARIABLE_STRIKES_ENABLED !== 'true')) {
        throw new ServerCustomLineupV2CreationError('invalid_selection');
      }
      const parsedTitle = displayTitle === undefined ? null : parseCustomLineupTitle(displayTitle);
      if ((ownerMode !== 'none' && !parsedTitle?.ok) || (parsedTitle !== null && !parsedTitle.ok)) {
        throw new ServerCustomLineupV2CreationError('invalid_selection');
      }
      let requested: CustomLineupIssuedChallenge;
      try {
        const clueSnapshot = dependencies.materializeClues(ids);
        requested = createCustomLineupIssuedChallenge({
          puzzleId: `custom-lineup-v2-${dependencies.mintUuid()}`,
          canonicalPlayerIds: ids,
          strikeLimit,
          clueSnapshot,
          issuedAt: dependencies.issuedAt(),
        });
      } catch {
        // Never reflect unknown canonical player IDs or unrevealed hint contents.
        throw new ServerCustomLineupV2CreationError('unsupported_players');
      }

      // The management capability is separate from both the unlisted play URL
      // and the creator-preview cookie. Only its digest enters persistence.
      const ownerCapability = ownerMode === 'capability'
        ? (dependencies.mintOwnerCapability ?? DEFAULT.mintOwnerCapability!)() : null;
      if (ownerCapability !== null && !/^[A-Za-z0-9_-]{43}$/.test(ownerCapability)) {
        throw new Error('Owner capability mint failed.');
      }
      const ownerDigest = ownerCapability === null ? undefined
        : createHash('sha256').update(ownerCapability, 'utf8').digest('hex');
      const repository = dependencies.createRepository(dependencies.createSupabaseClient(environment));
      const normalizedTitle = parsedTitle?.ok ? parsedTitle.title : undefined;
      const result = ownerMode === 'account'
        ? await repository.insertIfAbsent(requested, normalizedTitle, undefined, creatorAccountId)
        : ownerDigest === undefined
        ? await repository.insertIfAbsent(requested, normalizedTitle)
        : await repository.insertIfAbsent(requested, normalizedTitle, ownerDigest);
      // A UUID collision must not masquerade as successfully issued content.
      if (result.status !== 'inserted'
        || JSON.stringify(result.challenge) !== JSON.stringify(requested)) {
        throw new ServerCustomLineupV2CreationError('immutable_conflict');
      }
      return { puzzleId: requested.puzzleId, ownerCapability };
  }
  return {
    async issue(payload: unknown, displayTitle?: string): Promise<{ puzzleId: string }> {
      const result = await issueInternal(payload, displayTitle, 'none');
      return { puzzleId: result.puzzleId };
    },
    /**
     * Internal trusted service. HTTP callers MUST obtain creatorAccountId from
     * verifiedCreatorAccount(getUser()), never from submitted payload or email.
     */
    async issueForAccount(payload: unknown, displayTitle: string, creatorAccountId: string):
      Promise<{ puzzleId: string }> {
      const result = await issueInternal(payload, displayTitle, 'account', creatorAccountId);
      return { puzzleId: result.puzzleId };
    },
    async issueAnonymous(payload: unknown, displayTitle: string): Promise<{
      puzzleId: string; ownerCapability: string;
    }> {
      const result = await issueInternal(payload, displayTitle, 'capability');
      if (result.ownerCapability === null) throw new Error('Missing owner capability.');
      return { puzzleId: result.puzzleId, ownerCapability: result.ownerCapability };
    },
  };
}

function readSelection(payload: unknown): { ids: readonly string[]; strikeLimit: CustomLineupStrikeLimit } {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ServerCustomLineupV2CreationError('invalid_selection');
  }
  const fields = Object.keys(payload);
  if (!Object.hasOwn(payload, 'canonicalPlayerIds') || fields.length > 2
    || fields.some(field => field !== 'canonicalPlayerIds' && field !== 'strikeLimit')) {
    throw new ServerCustomLineupV2CreationError('invalid_selection');
  }
  // Only absent strikeLimit defaults to three. Explicit null/undefined and strings fail.
  const input = payload as Record<string, unknown>;
  const strikeLimit = Object.hasOwn(input, 'strikeLimit') ? input.strikeLimit : 3;
  if (strikeLimit !== 1 && strikeLimit !== 2 && strikeLimit !== 3) {
    throw new ServerCustomLineupV2CreationError('invalid_selection');
  }
  try {
    const ids = createCustomLineupSelection(
      input.canonicalPlayerIds as readonly string[],
    ).canonicalPlayerIds;
    return { ids, strikeLimit };
  } catch {
    throw new ServerCustomLineupV2CreationError('invalid_selection');
  }
}
