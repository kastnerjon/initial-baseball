import 'server-only';
import {
  createCustomLineupIssuedChallenge,
  validateCustomLineupPuzzleId,
  type CustomLineupIssuedChallenge,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decodeIssuedDailyClueSnapshot, record, stringArray, text, timestamp,
} from './supabaseIssuedDailyPuzzleRowCodecSupport';

/** Private issued-challenge adapter. Its full-row getById MUST NOT feed a public loader. */
export class CustomLineupV2IssuedReadError extends Error {
  constructor(public readonly kind: 'invalid-row' | 'query') {
    super('Private Custom Lineup v2 challenge unavailable.');
    this.name = 'CustomLineupV2IssuedReadError';
  }
}

export function decodeCustomLineupV2IssuedRow(value: unknown): CustomLineupIssuedChallenge {
  try {
    const row = record(value, 'Custom Lineup v2 issued challenge');
    if (row.schema_version !== 2 || row.ruleset_version !== 'points-v4') {
      throw new Error('Unsupported Custom Lineup version.');
    }
    return createCustomLineupIssuedChallenge({
      puzzleId: text(row.puzzle_id, 'puzzle_id'),
      canonicalPlayerIds: stringArray(row.canonical_player_ids, 'canonical_player_ids'),
      clueSnapshot: decodeIssuedDailyClueSnapshot(row.clue_snapshot, 'custom-v2'),
      issuedAt: timestamp(row.issued_at, 'issued_at'),
    });
  } catch {
    throw new CustomLineupV2IssuedReadError('invalid-row');
  }
}

const COLUMNS = 'puzzle_id,schema_version,ruleset_version,canonical_player_ids,clue_snapshot,issued_at';
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function createSupabaseCustomLineupV2IssuedReader(client: SupabaseClient) {
  return {
    /** Narrow creator owner read. Never fetch clues or answers for identity admission. */
    async getCreatorAccountId(puzzleId: string): Promise<string | null> {
      validateCustomLineupPuzzleId(puzzleId);
      let response;
      try {
        response = await client.from('custom_nine_issued_challenges')
          .select('creator_account_id')
          .eq('puzzle_id', puzzleId).eq('schema_version', 2).maybeSingle();
      } catch { throw new CustomLineupV2IssuedReadError('query'); }
      if (response.error !== null) throw new CustomLineupV2IssuedReadError('query');
      if (response.data === null) return null;
      const owner: unknown = response.data?.creator_account_id;
      if (owner !== null && (typeof owner !== 'string' || !ACCOUNT_ID.test(owner))) {
        throw new CustomLineupV2IssuedReadError('invalid-row');
      }
      return owner;
    },
    async getById(puzzleId: string): Promise<CustomLineupIssuedChallenge | null> {
      validateCustomLineupPuzzleId(puzzleId);
      let response;
      try {
        response = await client.from('custom_nine_issued_challenges')
          .select(COLUMNS).match({ puzzle_id: puzzleId, schema_version: 2 }).maybeSingle();
      } catch {
        throw new CustomLineupV2IssuedReadError('query');
      }
      if (response.error !== null) throw new CustomLineupV2IssuedReadError('query');
      if (response.data === null) return null;
      const challenge = decodeCustomLineupV2IssuedRow(response.data);
      if (challenge.puzzleId !== puzzleId) throw new CustomLineupV2IssuedReadError('invalid-row');
      return challenge;
    },
  };
}
