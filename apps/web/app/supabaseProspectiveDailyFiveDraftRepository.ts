import 'server-only';
import type { ProspectiveDailyFiveEditorialDraft } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseDailyPuzzleRepositoryError,
  decodeProspectiveDailyFiveDraftRow,
  encodeProspectiveDailyFiveDraftInsert,
} from './supabaseDailyPuzzleRowCodec';

// This is not imported by any public/admin route or the legacy nine-only repository.
const TABLE = 'daily_editorial_puzzles';
const COLUMNS = [
  'id', 'puzzle_date', 'puzzle_number', 'version', 'revision',
  'status', 'lineup_contract_version', 'selections',
  'created_at', 'created_by', 'updated_at', 'updated_by',
  'scheduled_at', 'scheduled_by', 'published_at', 'published_by',
  'archived_at', 'archived_by',
].join(',');

export type SupabaseProspectiveDailyFiveDraftRepository = {
  getByDate(date: string): Promise<ProspectiveDailyFiveEditorialDraft | null>;
  insertDraft(draft: ProspectiveDailyFiveEditorialDraft): Promise<ProspectiveDailyFiveEditorialDraft>;
};

/** Standalone, insert/read-only v2 persistence; no update, schedule or publish. */
export function createSupabaseProspectiveDailyFiveDraftRepository(
  client: SupabaseClient,
): SupabaseProspectiveDailyFiveDraftRepository {
  return {
    async getByDate(date) {
      const { data, error } = await client.from(TABLE)
        .select(COLUMNS).eq('puzzle_date', date).maybeSingle();
      if (error !== null) throwQueryError('read prospective Daily Five draft', error);
      return data === null ? null : decodeProspectiveDailyFiveDraftRow(data);
    },
    async insertDraft(draft) {
      // Validate before making any query or invoking a write.
      const payload = encodeProspectiveDailyFiveDraftInsert(draft);
      const { data, error } = await client.from(TABLE)
        .insert(payload).select(COLUMNS).single();
      if (error !== null) {
        if (error.code === '23505') {
          throw new SupabaseDailyPuzzleRepositoryError(
            'conflict', 'Daily editorial puzzle already exists for ' + draft.puzzleDate + '.',
          );
        }
        throwQueryError('insert prospective Daily Five draft', error);
      }
      const stored = decodeProspectiveDailyFiveDraftRow(data);
      if (stored.id !== draft.id || stored.puzzleDate !== draft.puzzleDate
        || stored.puzzleNumber !== draft.puzzleNumber
        || stored.selections.some((s, index) =>
          s.canonicalPlayerId !== draft.selections[index]?.canonicalPlayerId
          || s.source !== draft.selections[index]?.source)) {
        throw new SupabaseDailyPuzzleRepositoryError(
          'invalid-row', 'Inserted Daily Five draft does not match requested immutable lineup.',
        );
      }
      return stored;
    },
  };
}

function throwQueryError(operation: string, error: { message: string }): never {
  throw new SupabaseDailyPuzzleRepositoryError('query', 'Could not ' + operation + ': ' + error.message);
}
