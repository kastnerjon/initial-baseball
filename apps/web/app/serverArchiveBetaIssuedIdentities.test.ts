import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import { listIssuedArchiveBetaIdentities } from './serverArchiveBetaIssuedIdentities';

function setup(pages: unknown[][]) {
  const q = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const method of [q.select, q.eq, q.gte, q.lt, q.order]) method.mockReturnValue(q);
  for (const data of pages) q.range.mockResolvedValueOnce({ data, error: null });
  return { q, client: { from: vi.fn(() => q) } as unknown as SupabaseClient };
}
const row = (i: number) => ({ daily_number: i + 1, puzzle_date: new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10), puzzle_id: `archive-beta-v1-daily-${i + 1}` });
describe('rollover issued identity batches', () => {
  it('pages metadata without answer/clue columns or one request per historical date', async () => {
    const s = setup([Array.from({ length: 500 }, (_, i) => row(i)), [row(500)]]);
    expect(await listIssuedArchiveBetaIdentities(s.client, '2028-10-07')).toHaveLength(501);
    expect(s.q.select).toHaveBeenCalledWith('daily_number,puzzle_date,puzzle_id');
    expect(s.q.eq).toHaveBeenCalledWith('series_version', 'archive-beta-v1');
    expect(s.q.eq).toHaveBeenCalledWith('schema_version', 2);
    expect(s.q.lt).toHaveBeenCalledWith('puzzle_date', '2028-10-07');
    expect(s.q.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });
  it('rejects mismatched IDs/dates and provider errors without exposing snapshots', async () => {
    for (const invalid of [{ ...row(0), puzzle_id: 'permanent-v1-daily-1' }, { ...row(0), daily_number: 9 }, { ...row(0), puzzle_date: '2026-10-07' }]) {
      const s = setup([[invalid]]);
      await expect(listIssuedArchiveBetaIdentities(s.client, '2026-10-07')).rejects.toThrow('Invalid issued');
    }
    const s = setup([]);
    s.q.range.mockResolvedValueOnce({ data: null, error: { message: 'private payload' } });
    await expect(listIssuedArchiveBetaIdentities(s.client, '2026-10-07')).rejects.toThrow('Issued archive identities are unavailable.');
  });
});
