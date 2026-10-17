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

  it('reads a mixed-version horizon as date-only occupancy with explicit gaps', async () => {
    const rows = [
      { ...v1, puzzle_date: '2026-11-19', selections: ['secret'] },
      { ...v2, puzzle_date: '2026-11-18', selections: ['secret'] },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const select = vi.fn().mockReturnValue({ gte });
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader({
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient);
    const horizon = await reader.getHorizon(DATE, 3);
    expect(horizon).toEqual([
      { date: DATE, occupancy: { puzzleDate: DATE, lineupContractVersion: 2, status: 'draft' } },
      { date: '2026-11-19', occupancy: { puzzleDate: '2026-11-19', lineupContractVersion: 1, status: 'scheduled' } },
      { date: '2026-11-20', occupancy: null },
    ]);
    expect(JSON.stringify(horizon)).not.toContain('secret');
    expect(select).toHaveBeenCalledWith('puzzle_date,lineup_contract_version,status');
    expect(gte).toHaveBeenCalledWith('puzzle_date', DATE);
    expect(lte).toHaveBeenCalledWith('puzzle_date', '2026-11-20');
    expect(order).toHaveBeenCalledWith('puzzle_date', { ascending: true });
  });

  it.each([
    { rows: [{ ...v2, lineup_contract_version: 3 }] },
    { rows: [{ ...v2, status: 'unexpected' }] },
    { rows: [v2, v2] },
    { rows: [{ ...v1, puzzle_date: '2026-11-21' }] },
  ])('fails closed on unknown, duplicate or out-of-range horizon rows: %j', async ({ rows }) => {
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const select = vi.fn().mockReturnValue({ gte });
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader({
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient);
    await expect(reader.getHorizon(DATE, 2)).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('never treats a failed or malformed range query as an empty horizon', async () => {
    const order = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'secret db' } })
      .mockResolvedValueOnce({ data: null, error: null });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader({
      from: vi.fn().mockReturnValue({ select: () => ({ gte }) }),
    } as unknown as SupabaseClient);
    await expect(reader.getHorizon(DATE, 2)).rejects.toMatchObject({ kind: 'query' });
    await expect(reader.getHorizon(DATE, 2)).rejects.toMatchObject({ kind: 'invalid-row' });
  });

  it('rejects invalid dates and length before querying', async () => {
    const from = vi.fn();
    const reader = createSupabaseDailyEditorialCalendarOccupancyReader({
      from,
    } as unknown as SupabaseClient);
    for (const [date, days] of [['2026-02-30', 2], [DATE, 0], [DATE, 32], [DATE, 1.5], ['9999-12-31', 2]] as const) {
      await expect(reader.getHorizon(date, days)).rejects.toMatchObject({ kind: 'invalid-row' });
    }
    expect(from).not.toHaveBeenCalled();
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
