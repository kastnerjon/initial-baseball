import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDailyPuzzleRepositoryError } from './supabaseDailyPuzzleRowCodec';

export type DailyEditorialCalendarOccupancy = Readonly<{
  puzzleDate: string;
  lineupContractVersion: 1 | 2;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
}>;

/**
 * Read only, no player IDs, clues, full puzzle rows, or v1/v2 draft decoding.
 * Shared date-unique editorial table must be inspected before a safe cutover.
 */
export function createSupabaseDailyEditorialCalendarOccupancyReader(client: SupabaseClient): {
  getByDate(puzzleDate: string): Promise<DailyEditorialCalendarOccupancy | null>;
} {
  return {
    async getByDate(puzzleDate) {
      const { data, error } = await client.from('daily_editorial_puzzles')
        .select('puzzle_date,lineup_contract_version,status')
        .eq('puzzle_date', puzzleDate).maybeSingle();
      if (error !== null) {
        throw new SupabaseDailyPuzzleRepositoryError(
          'query', 'Could not inspect Daily editorial date: ' + error.message,
        );
      }
      return data === null ? null : decodeDailyEditorialCalendarOccupancy(data);
    },
  };
}

export function decodeDailyEditorialCalendarOccupancy(value: unknown): DailyEditorialCalendarOccupancy {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('row is not an object');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.puzzle_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.puzzle_date)
    || !Number.isFinite(Date.parse(row.puzzle_date + 'T00:00:00Z'))
    || new Date(row.puzzle_date + 'T00:00:00Z').toISOString().slice(0, 10) !== row.puzzle_date) {
    return invalid('date is invalid');
  }
  if (row.lineup_contract_version !== 1 && row.lineup_contract_version !== 2) {
    return invalid('lineup contract is unrecognized');
  }
  if (row.status !== 'draft' && row.status !== 'scheduled'
    && row.status !== 'published' && row.status !== 'archived') {
    return invalid('status is invalid');
  }
  return {
    puzzleDate: row.puzzle_date,
    lineupContractVersion: row.lineup_contract_version,
    status: row.status,
  };
}

function invalid(reason: string): never {
  throw new SupabaseDailyPuzzleRepositoryError(
    'invalid-row', 'Invalid Daily editorial calendar occupancy: ' + reason,
  );
}
