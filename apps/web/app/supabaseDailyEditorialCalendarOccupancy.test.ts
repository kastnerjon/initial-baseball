import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseDailyEditorialCalendarOccupancyReader,
  decodeDailyEditorialCalendarOccupancy,
} from './supabaseDailyEditorialCalendarOccupancy';

const DATE = '2026-11-18';
const v1 = { puzzle_date: DATE, lineup_contract_version: 1, status: 'scheduled' };
const v2 = { puzzle_date: DATE, lineup_contract_version: 2, status: 'draft' };

describe('contract-aware read-only Daily editorial calendar occupancy', () => {
  it('decodes both contracts without materializing selections or identities', () => {
    expect(decodeDailyEditorialCalendarOccupancy({ ...v1, selections: ['secret-player'] }))
      .toEqual({ puzzleDate: DATE, lineupContractVersion: 1, status: 'scheduled' });
    expect(decodeDailyEditorialCalendarOccupancy(v2))
      .toEqual({ puzzleDate: DATE, lineupContractVersion: 2, status: 'draft' });
  });

  it.each([
    { ...v1, lineup_contract_version: null },
    { ...v1, lineup_contract_version: 3 },
    { ...v1, lineup_contract_version: '1' },
    { ...v1, status: 'unknown' },
    { ...v1, puzzle_date: '2026-02-30' },
    { ...v1, puzzle_date: '' },
    null, [],
  ])('fails closed on invalid persisted metadata: %j', row => {
    expect(() => decodeDailyEditorialCalendarOccupancy(row))
      .toThrow('Invalid Daily editorial calendar occupancy');
  });

  it('queries only the three minimal metadata columns by date and supports absence', async () => {
    const maybeSingle = vi.fn().mockResolvedValueOnce({ data: v2, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader(
      { from } as unknown as SupabaseClient,
    );
    await expect(reader.getByDate(DATE)).resolves.toEqual({
      puzzleDate: DATE, lineupContractVersion: 2, status: 'draft',
    });
    await expect(reader.getByDate(DATE)).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith('daily_editorial_puzzles');
    expect(select).toHaveBeenCalledWith('puzzle_date,lineup_contract_version,status');
    expect(eq).toHaveBeenCalledWith('puzzle_date', DATE);
  });

  it('does not treat a DB read failure as a vacant date', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null, error: { message: 'provider down' },
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader({
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient);
    await expect(reader.getByDate(DATE)).rejects.toMatchObject({ kind: 'query' });
  });
});
