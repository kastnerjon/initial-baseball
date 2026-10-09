import 'server-only';
import {
  validateCustomNinePuzzleId,
  type CustomNineIssuedChallenge,
  type CustomNineIssuedChallengeRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decodeCustomNineIssuedChallengeRow,
  encodeCustomNineIssuedChallengeRow,
  SupabaseCustomNineIssuedChallengeRepositoryError,
} from './supabaseCustomNineIssuedChallengeRowCodec';

const TABLE = 'custom_nine_issued_challenges';
const COLUMNS = [
  'puzzle_id',
  'schema_version',
  'ruleset_version',
  'canonical_player_ids',
  'clue_snapshot',
  'issued_at',
].join(',');

export {
  SupabaseCustomNineIssuedChallengeRepositoryError,
  type SupabaseCustomNineIssuedChallengeRepositoryErrorKind,
} from './supabaseCustomNineIssuedChallengeRowCodec';

/** Service-role-only storage adapter. Do not pass its client to browser code. */
export function createSupabaseCustomNineIssuedChallengeRepository(
  client: SupabaseClient,
): CustomNineIssuedChallengeRepository {
  return {
    async insertIfAbsent(challenge) {
      const row = encodeCustomNineIssuedChallengeRow(challenge);
      const response = await runQuery('insert', () =>
        client.from(TABLE).insert(row).select(COLUMNS).single());

      if (response.error === null) {
        return { status: 'inserted', challenge: decodeExpected(response.data, challenge.puzzleId) };
      }
      if (response.error.code !== '23505') throw queryError('insert');

      // The PK winner is immutable: never upsert/update after a unique conflict.
      const existing = await readById(client, challenge.puzzleId);
      if (existing === null) throw queryError('read conflicted');
      return { status: 'existing', challenge: existing };
    },

    getById(puzzleId) {
      validateCustomNinePuzzleId(puzzleId);
      return readById(client, puzzleId);
    },
  };
}

async function readById(
  client: SupabaseClient,
  puzzleId: string,
): Promise<CustomNineIssuedChallenge | null> {
  const response = await runQuery('read', () =>
    client.from(TABLE).select(COLUMNS).match({ puzzle_id: puzzleId }).maybeSingle());
  if (response.error !== null) throw queryError('read');
  return response.data === null ? null : decodeExpected(response.data, puzzleId);
}

function decodeExpected(row: unknown, expectedId: string): CustomNineIssuedChallenge {
  const challenge = decodeCustomNineIssuedChallengeRow(row);
  if (challenge.puzzleId !== expectedId) {
    throw new SupabaseCustomNineIssuedChallengeRepositoryError(
      'invalid-row',
      'Private Custom Nine challenge identity mismatch.',
    );
  }
  return challenge;
}

async function runQuery<T>(operation: string, query: () => PromiseLike<T>): Promise<T> {
  try {
    return await query();
  } catch {
    throw queryError(operation);
  }
}

function queryError(operation: string): SupabaseCustomNineIssuedChallengeRepositoryError {
  return new SupabaseCustomNineIssuedChallengeRepositoryError(
    'query',
    `Could not ${operation} a private Custom Nine challenge.`,
  );
}
