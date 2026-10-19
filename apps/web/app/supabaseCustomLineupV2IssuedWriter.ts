import 'server-only';
import {
  cloneCustomLineupIssuedChallenge,
  type CustomLineupIssuedChallenge,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseCustomLineupV2IssuedReader,
  decodeCustomLineupV2IssuedRow,
} from './supabaseCustomLineupV2IssuedReader';

const TABLE = 'custom_nine_issued_challenges';
const COLUMNS = 'puzzle_id,schema_version,ruleset_version,canonical_player_ids,clue_snapshot,issued_at';

export class CustomLineupV2IssuedWriteError extends Error {
  constructor(public readonly kind: 'query' | 'invalid-row') {
    super('Private Custom Lineup v2 issuance unavailable.');
    this.name = 'CustomLineupV2IssuedWriteError';
  }
}

/** Encode only the already-validated immutable schema-v2 fields. */
export function encodeCustomLineupV2IssuedRow(
  challenge: CustomLineupIssuedChallenge, displayTitle?: string, ownerCapabilityDigest?: string,
) {
  const value = cloneCustomLineupIssuedChallenge(challenge);
  return {
    puzzle_id: value.puzzleId,
    schema_version: value.schemaVersion,
    ruleset_version: value.rulesetVersion,
    canonical_player_ids: [...value.canonicalPlayerIds],
    clue_snapshot: {
      schemaVersion: value.clueSnapshot.schemaVersion,
      hintLayout: value.clueSnapshot.hintLayout.map(hint => ({ ...hint })),
      pitches: value.clueSnapshot.pitches.map(pitch => ({
        pitchNumber: pitch.pitchNumber,
        canonicalPlayerId: pitch.canonicalPlayerId,
        initials: pitch.initials,
        hintValues: [...pitch.hintValues],
      })),
    },
    issued_at: value.issuedAt,
    ...(displayTitle === undefined ? {} : { display_title: displayTitle }),
    ...(ownerCapabilityDigest === undefined ? {} : { owner_capability_digest: ownerCapabilityDigest }),
  };
}

/** Service-role only. Insert once; never mutate or upsert an issued answer snapshot. */
export function createSupabaseCustomLineupV2IssuedWriter(client: SupabaseClient) {
  return {
    async insertIfAbsent(
      challenge: CustomLineupIssuedChallenge, displayTitle?: string, ownerCapabilityDigest?: string,
    ):
      Promise<{ status: 'inserted' | 'existing'; challenge: CustomLineupIssuedChallenge }> {
      const row = encodeCustomLineupV2IssuedRow(challenge, displayTitle, ownerCapabilityDigest);
      let response;
      try {
        response = await client.from(TABLE).insert(row).select(COLUMNS).single();
      } catch {
        throw new CustomLineupV2IssuedWriteError('query');
      }
      if (response.error === null) {
        let stored: CustomLineupIssuedChallenge;
        try { stored = decodeCustomLineupV2IssuedRow(response.data); }
        catch { throw new CustomLineupV2IssuedWriteError('invalid-row'); }
        if (stored.puzzleId !== challenge.puzzleId) {
          throw new CustomLineupV2IssuedWriteError('invalid-row');
        }
        return { status: 'inserted', challenge: stored };
      }
      if (response.error.code !== '23505') throw new CustomLineupV2IssuedWriteError('query');
      // A UUID collision must never overwrite a frozen challenge, including legacy rows.
      let stored: CustomLineupIssuedChallenge | null;
      try { stored = await createSupabaseCustomLineupV2IssuedReader(client).getById(challenge.puzzleId); }
      catch { throw new CustomLineupV2IssuedWriteError('query'); }
      if (stored === null) throw new CustomLineupV2IssuedWriteError('query');
      return { status: 'existing', challenge: stored };
    },
  };
}
