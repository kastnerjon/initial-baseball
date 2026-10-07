import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readDailyAdminAttemptReport } from './serverDailyAdminAttemptReport';
import { GET } from './admin/daily/attempts/export/route';

const authorization = `Basic ${Buffer.from('owner:password-which-has-at-least-32-characters').toString('base64')}`;
beforeEach(() => { vi.stubEnv('DAILY_ADMIN_USERNAME', 'owner'); vi.stubEnv('DAILY_ADMIN_PASSWORD', 'password-which-has-at-least-32-characters'); });
afterEach(() => vi.unstubAllEnvs());

function fakeClient(data: Record<string, Record<string, unknown>[]>) {
  const calls: { table: string; filters: [string, unknown][]; limit: number }[] = [];
  const client = { from(table: string) {
    const call = { table, filters: [] as [string, unknown][], limit: 0 }; calls.push(call);
    const query = {
      select: (_columns: string) => query,
      eq: (field: string, value: unknown) => { call.filters.push([field, value]); return query; },
      gt: (field: string, value: string) => { call.filters.push([`${field}>`, value]); return query; },
      in: (field: string, values: string[]) => { call.filters.push([`${field} in`, values]); return query; },
      order: (_field: string) => query,
      limit: (limit: number) => {
        call.limit = limit;
        let rows = data[table] ?? [];
        for (const [key, value] of call.filters) {
          rows = rows.filter(row => key.endsWith(' in') ? (value as string[]).includes(String(row[key.slice(0, -3)]))
            : key.endsWith('>') ? String(row[key.slice(0, -1)]) > String(value) : row[key] === value);
        }
        return Promise.resolve({ data: rows.slice(0, limit), error: null });
      },
    }; return query;
  } } as unknown as SupabaseClient;
  return { client, calls };
}
function rawAb(id: string, pitch = 1) {
  return { attempt_id: id, schema_version: 1, puzzle_id: 'edition', puzzle_date: '2026-10-06', puzzle_number: 163,
    ruleset_version: 'points-v4', pitch_number: pitch, initials: 'TR', outcome: 'HR', hints_revealed: 0,
    wrong_guesses: 0, resolution: 'correct', awarded_points: 4, created_at: '2026-10-07T01:00:00Z' };
}
function rawCompletion(id: string) {
  return { submission_id: id, schema_version: 1, puzzle_id: 'edition', puzzle_date: '2026-10-06', puzzle_number: 163,
    ruleset_version: 'points-v4', completed_at_bats: Array.from({ length: 9 }, (_, i) => ({ pitchNumber: i + 1, initials: 'TR', outcome: 'HR', hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct' })),
    summary: { points: 36, maximumPoints: 36, atBatsCompleted: 9, totalAtBats: 9, completed: true, strikeouts: 0 }, created_at: '2026-10-07T01:00:00Z' };
}
describe('Private admin attempt reads', () => {
  it('authorizes before constructing a client and validates before reading', async () => {
    const createClient = vi.fn();
    const dependencies = { createClient, currentDate: () => '2026-10-06' };
    await expect(readDailyAdminAttemptReport(null, new URLSearchParams(), dependencies)).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(readDailyAdminAttemptReport(authorization, new URLSearchParams('date=bad'), dependencies)).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });
  it('protects direct CSV requests with a no-store Basic challenge', async () => {
    const response = await GET(new Request('https://example.com/admin/daily/attempts/export?date=bad'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('www-authenticate')).toContain('Basic');
    expect(await response.text()).not.toContain('attempt_id');
  });
  it('keeps database stream cursors independent, joins IDs and preserves whole AB rows', async () => {
    // Input order deliberately differs from JS order: cursor choice must follow DB order.
    const ids = Array.from({ length: 51 }, (_, i) => `id${String(i).padStart(3, '0')}`).reverse();
    const fake = fakeClient({ daily_at_bat_results: ids.flatMap(id => Array.from({ length: 9 }, (_, i) => rawAb(id, i + 1))),
      daily_completed_results: ids.map(rawCompletion) });
    const report = await readDailyAdminAttemptReport(authorization, new URLSearchParams('puzzleId=edition'), {
      createClient: () => fake.client, currentDate: () => '2026-10-06',
    });
    expect(report.rows).toHaveLength(50);
    expect(report.rows.every(row => row.recordedAtBats === 9 && row.completedPoints === 36)).toBe(true);
    expect(report.next).toMatchObject({ abAfter: ids[49], completedAfter: ids[49] });
    expect(fake.calls.map(call => call.limit)).toEqual([451, 51, 50, 450]);
    for (const call of fake.calls) {
      expect(call.filters).toContainEqual(['puzzle_id', 'edition']);
      expect(call.filters).toContainEqual(['ruleset_version', 'points-v4']);
      expect(call.filters).toContainEqual(['puzzle_date', '2026-10-06']);
    }
  });
  it('includes completion-only attempts and does not infer AB receipts from them', async () => {
    const fake = fakeClient({ daily_at_bat_results: [rawAb('partial')], daily_completed_results: [rawCompletion('only-completed')] });
    const report = await readDailyAdminAttemptReport(authorization, new URLSearchParams('puzzleId=edition'), {
      createClient: () => fake.client, currentDate: () => '2026-10-06',
    });
    expect(report.rows.map(row => row.id)).toEqual(['only-completed', 'partial']);
    expect(report.rows[0]).toMatchObject({ recordedAtBats: 0, completedPoints: 36 });
    expect(report.rows[0]!.scores[0]!.source).toBe('completion');
    expect(report.next).toBeNull();
  });
  it('browses both streams without dropping or duplicating stable attempts', async () => {
    const abs = Array.from({ length: 65 }, (_, i) => rawAb(`a${String(i).padStart(3, '0')}`));
    const completed = [...abs.slice(10, 40).map(row => rawCompletion(String(row.attempt_id))),
      ...Array.from({ length: 60 }, (_, i) => rawCompletion(`c${String(i).padStart(3, '0')}`))];
    const fake = fakeClient({ daily_at_bat_results: abs, daily_completed_results: completed });
    const dependencies = { createClient: () => fake.client, currentDate: () => '2026-10-06' };
    let params = new URLSearchParams('puzzleId=edition');
    const seen: string[] = [];
    for (let page = 0; page < 5; page++) {
      const report = await readDailyAdminAttemptReport(authorization, params, dependencies);
      seen.push(...report.rows.map(row => row.id));
      if (!report.next) break;
      params = new URLSearchParams(report.next);
    }
    expect(seen).toHaveLength(125);
    expect(new Set(seen).size).toBe(125);
    expect(seen).toContain('a064');
    expect(seen).toContain('c059');
  });
});
