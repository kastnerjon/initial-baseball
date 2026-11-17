import { describe, expect, it, vi } from 'vitest';
import { createOfficialDailyAttemptReservationService, type OfficialDailyAttemptReservation } from './officialDailyAttemptReservation';
vi.mock('server-only', () => ({}));

const ID = 'daily-ed-v1-11111111-1111-4111-8111-111111111111';
const OTHER = 'daily-ed-v1-22222222-2222-4222-8222-222222222222';
const KEY = 'a'.repeat(48);
function setup() {
  const rows = new Map<string, OfficialDailyAttemptReservation>();
  let counter = 0;
  const service = createOfficialDailyAttemptReservationService({
    now: () => new Date('2026-11-16T12:00:00.000Z'),
    createAttemptId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    store: { async insertOrRead(candidate) {
      const key = [candidate.puzzleId, candidate.rulesetVersion, candidate.browserKeyDigest].join('/');
      const previous = rows.get(key);
      if (previous) return previous;
      rows.set(key, candidate);
      return candidate;
    } },
  });
  return { service, rows };
}
const request = { puzzleId: ID, puzzleDate: '2026-11-16', rulesetVersion: 'points-v4' as const, browserKey: KEY };

describe('source-only official Daily first-start reservation contract', () => {
  it('returns the first attempt on repeated and concurrent starts', async () => {
    const { service, rows } = setup();
    const [first, second, third] = await Promise.all([
      service.reserve(request), service.reserve(request), service.reserve(request),
    ]);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(rows.size).toBe(1);
    expect(first.browserKeyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.browserKeyDigest).not.toBe(KEY);
  });
  it('separates identical-roster editions and browser credentials', async () => {
    const { service, rows } = setup();
    const a = await service.reserve(request);
    const b = await service.reserve({ ...request, puzzleId: OTHER });
    const c = await service.reserve({ ...request, browserKey: 'b'.repeat(48) });
    expect(new Set([a.attemptId, b.attemptId, c.attemptId]).size).toBe(3);
    expect(rows.size).toBe(3);
  });
  it('rejects a store returning mismatched edition, date, credential or incompatible attempt UUID', async () => {
    const { service } = setup();
    const original = await service.reserve(request);
    const invalidRows = [
      { ...original, puzzleId: OTHER },
      { ...original, puzzleDate: '2026-11-17' },
      { ...original, browserKeyDigest: 'f'.repeat(64) },
      { ...original, attemptId: '00000000-0000-1000-8000-000000000001' },
    ];
    for (const row of invalidRows) {
      const invalid = createOfficialDailyAttemptReservationService({
        now: () => new Date(), store: { insertOrRead: async () => row },
      });
      await expect(invalid.reserve(request)).rejects.toThrow('mismatch');
    }
  });
  it('rejects malformed edition UUIDs, non-calendar dates and weak browser keys before storage', async () => {
    const { service, rows } = setup();
    await expect(service.reserve({ ...request, puzzleId: 'daily-legacy' })).rejects.toThrow();
    await expect(service.reserve({ ...request, puzzleId: 'daily-ed-v1-' + '-'.repeat(36) })).rejects.toThrow();
    await expect(service.reserve({ ...request, puzzleId: 'daily-ed-v1-11111111-1111-1111-8111-111111111111' })).rejects.toThrow();
    await expect(service.reserve({ ...request, puzzleDate: '2026-02-30' })).rejects.toThrow();
    await expect(service.reserve({ ...request, puzzleDate: '2026-99-99' })).rejects.toThrow();
    await expect(service.reserve({ ...request, browserKey: 'short' })).rejects.toThrow();
    expect(rows.size).toBe(0);
  });
  it('reconciles an insert response lost after commit when the durable store returns the same winner', async () => {
    const rows = new Map<string, OfficialDailyAttemptReservation>();
    let lost = true;
    const service = createOfficialDailyAttemptReservationService({
      now: () => new Date('2026-11-16T12:00:00.000Z'),
      store: { async insertOrRead(candidate) {
        const key = [candidate.puzzleId, candidate.browserKeyDigest].join(':');
        const row = rows.get(key) ?? candidate;
        rows.set(key, row);
        if (lost) { lost = false; throw new Error('connection lost after commit'); }
        return row;
      } },
    });
    await expect(service.reserve(request)).rejects.toThrow('connection lost');
    const committed = [...rows.values()][0];
    expect(await service.reserve(request)).toEqual(committed);
    expect(rows.size).toBe(1);
  });
});
