import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDailyPuzzleRepositoryError } from './supabaseDailyPuzzleRowCodec';

export type DailyEditorialCalendarOccupancy = Readonly<{
  puzzleDate: string;
  lineupContractVersion: 1 | 2;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
}>;

export type DailyEditorialCalendarHorizonSlot = Readonly<{
  date: string;
  occupancy: DailyEditorialCalendarOccupancy | null;
}>;

/**
 * Read only, no player IDs, clues, full puzzle rows, or v1/v2 draft decoding.
 * Shared date-unique editorial table must be inspected before a safe cutover.
 */
export function createSupabaseDailyEditorialCalendarOccupancyReader(client: SupabaseClient): {
  getByDate(puzzleDate: string): Promise<DailyEditorialCalendarOccupancy | null>;
  getHorizon(startDate: string, days: number): Promise<readonly DailyEditorialCalendarHorizonSlot[]>;
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
    async getHorizon(startDate, days) {
      if (!Number.isInteger(days) || days < 1 || days > 31) return invalid('horizon days must be 1–31');
      // Validate before any database call; the calendar is a UTC date-only domain.
      const start = calendarTimestamp(startDate);
      const dates = Array.from({ length: days }, (_, index) =>
        new Date(start + index * 86400000).toISOString().slice(0, 10));
      if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
        return invalid('horizon exceeds supported calendar dates');
      }
      const { data, error } = await client.from('daily_editorial_puzzles')
        .select('puzzle_date,lineup_contract_version,status')
        .gte('puzzle_date', dates[0]!)
        .lte('puzzle_date', dates.at(-1)!)
        .order('puzzle_date', { ascending: true });
      if (error !== null) {
        throw new SupabaseDailyPuzzleRepositoryError(
          'query', 'Could not inspect Daily editorial horizon: ' + error.message,
        );
      }
      if (!Array.isArray(data)) return invalid('horizon rows are not an array');
      const byDate = new Map<string, DailyEditorialCalendarOccupancy>();
      for (const raw of data) {
        const occupancy = decodeDailyEditorialCalendarOccupancy(raw);
        if (occupancy.puzzleDate < dates[0]! || occupancy.puzzleDate > dates.at(-1)!
          || byDate.has(occupancy.puzzleDate)) return invalid('horizon dates are duplicated or out of range');
        byDate.set(occupancy.puzzleDate, occupancy);
      }
      return dates.map(date => ({ date, occupancy: byDate.get(date) ?? null }));
    },
  };
}

export function decodeDailyEditorialCalendarOccupancy(value: unknown): DailyEditorialCalendarOccupancy {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('row is not an object');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.puzzle_date !== 'string') return invalid('date is invalid');
  calendarTimestamp(row.puzzle_date);
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

function calendarTimestamp(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalid('date is invalid');
  const timestamp = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    return invalid('date is invalid');
  }
  return timestamp;
}

function invalid(reason: string): never {
  throw new SupabaseDailyPuzzleRepositoryError(
    'invalid-row', 'Invalid Daily editorial calendar occupancy: ' + reason,
  );
}
