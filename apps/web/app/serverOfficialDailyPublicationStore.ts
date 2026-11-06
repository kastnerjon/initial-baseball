import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import type { OfficialDailyPublicationInput } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';

const TABLE = 'official_daily_publications';

/** Internal writer. Callers must load an authorized, revision-checked editorial occurrence. */
export async function storeOfficialDailyPublication(
  client: SupabaseClient,
  input: OfficialDailyPublicationInput,
) {
  const puzzle = prepareServerOfficialDailyPublication(input);
  const row = {
    puzzle_id: puzzle.puzzleId,
    puzzle_date: puzzle.puzzleDate,
    puzzle_number: puzzle.puzzleNumber,
    edition_key: puzzle.editionKey,
    edition_number: puzzle.editionNumber,
    title: puzzle.title,
    schema_version: puzzle.schemaVersion,
    ruleset_version: puzzle.rulesetVersion,
    clue_snapshot: puzzle.clueSnapshot,
  };
  // Exclude the database-assigned issue timestamp from replay equivalence.
  const columns = Object.keys(row).join(',');
  try {
    const inserted = await client.from(TABLE).insert(row).select(columns).single();
    if (inserted.error === null && isDeepStrictEqual(inserted.data, row)) {
      return { status: 'created', puzzleId: puzzle.puzzleId } as const;
    }
    if (inserted.error?.code !== '23505') throw new Error();

    // Uniqueness also covers date/key and date/number. A collision on either
    // with a different ID is a conflict, even if both editions have identical rosters.
    const existing = await client.from(TABLE).select(columns).eq('puzzle_id', puzzle.puzzleId).maybeSingle();
    if (existing.error !== null) throw new Error();
    if (isDeepStrictEqual(existing.data, row)) {
      return { status: 'existing', puzzleId: puzzle.puzzleId } as const;
    }
    return { status: 'conflict' } as const;
  } catch {
    // PostgREST error details and invalid rows can contain future answers.
    throw new Error('Unable to verify official Daily publication storage.');
  }
}
