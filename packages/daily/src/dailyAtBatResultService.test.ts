import type { DailyAtBatResult } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createDailyAtBatResultService,
  type DailyAtBatResultRepository,
  type DailyAtBatResultRepositoryInsertResult,
} from './dailyAtBatResultService';

function observation(): DailyAtBatResult {
  return {
    schemaVersion: 1, attemptId: 'attempt-1', puzzleId: 'puzzle-version-1',
    puzzleDate: '2026-09-18', puzzleNumber: 145, rulesetVersion: 'points-v3',
    atBat: { pitchNumber: 9, initials: 'AB', outcome: '3B', hintsRevealed: 1, wrongGuesses: 1, resolution: 'correct' },
    awardedPoints: 5,
  };
}

/** Contract double, not evidence of database concurrency behavior. */
class Repository implements DailyAtBatResultRepository {
  readonly rows: DailyAtBatResult[] = [];
  async insertIfAbsent(result: DailyAtBatResult): Promise<DailyAtBatResultRepositoryInsertResult> {
    const existing = this.rows.find(row => row.attemptId === result.attemptId
      && row.puzzleId === result.puzzleId && row.rulesetVersion === result.rulesetVersion
      && row.atBat.pitchNumber === result.atBat.pitchNumber);
    if (existing) return { status: 'existing', result: structuredClone(existing) };
    this.rows.push(structuredClone(result));
    return { status: 'inserted', result: structuredClone(result) };
  }
}

describe('Daily at-bat result service', () => {
  it('stores complete normalized facts and points with one atomic call', async () => {
    const result = observation();
    const insertIfAbsent = vi.fn().mockResolvedValue({ status: 'inserted', result });
    expect(await createDailyAtBatResultService({ insertIfAbsent }).store(result))
      .toEqual({ ok: true, status: 'created', result });
    expect(insertIfAbsent).toHaveBeenCalledExactlyOnceWith(result);
  });

  it('accepts a deep-equivalent retry regardless of property order', async () => {
    const repository = new Repository();
    const service = createDailyAtBatResultService(repository);
    const first = observation();
    await service.store(first);
    const reordered = Object.fromEntries(Object.entries(first).reverse()) as DailyAtBatResult;
    reordered.atBat = Object.fromEntries(Object.entries(first.atBat).reverse()) as DailyAtBatResult['atBat'];
    expect(await service.store(reordered)).toEqual({ ok: true, status: 'existing', result: first });
    expect(repository.rows).toEqual([first]);
  });

  it('keeps points-v3 and points-v4 observations in distinct exact-version keys', async () => {
    const repository = new Repository();
    const service = createDailyAtBatResultService(repository);
    const v3 = observation();
    const v4: DailyAtBatResult = {
      ...observation(),
      rulesetVersion: 'points-v4',
      awardedPoints: 3,
    };

    expect(await service.store(v3)).toMatchObject({ ok: true, status: 'created' });
    expect(await service.store(v4)).toMatchObject({ ok: true, status: 'created' });
    expect(repository.rows).toEqual([v3, v4]);
  });

  it('handles overlapping identical calls through the atomic port', async () => {
    const repository = new Repository();
    const service = createDailyAtBatResultService(repository);
    const results = await Promise.all([service.store(observation()), service.store(observation())]);
    expect(results.map(result => result.ok && result.status).sort()).toEqual(['created', 'existing']);
    expect(repository.rows).toHaveLength(1);
  });

  it('keeps the first winner on conflicting calls without disclosing its facts', async () => {
    const repository = new Repository();
    const service = createDailyAtBatResultService(repository);
    const first = observation();
    const changed = observation();
    changed.atBat.wrongGuesses = 2;
    changed.awardedPoints = 4;
    const results = await Promise.all([service.store(first), service.store(changed)]);
    expect(results[1]).toEqual({ ok: false, error: 'idempotency_conflict', key: {
      attemptId: first.attemptId, puzzleId: first.puzzleId, rulesetVersion: first.rulesetVersion, pitchNumber: 9,
    } });
    expect(repository.rows).toEqual([first]);
  });

  const metadataChanges: [string, (result: DailyAtBatResult) => void][] = [
    ['schema', result => { (result as { schemaVersion: number }).schemaVersion = 2; }],
    ['date', result => { result.puzzleDate = '2026-09-19'; }],
    ['number', result => { result.puzzleNumber = 146; }],
    ['points', result => { result.awardedPoints = 4; }],
    ['initials', result => { result.atBat.initials = 'CD'; }],
    ['outcome', result => { result.atBat.outcome = 'HR'; }],
    ['hints', result => { result.atBat.hintsRevealed = 2; }],
    ['wrong guesses', result => { result.atBat.wrongGuesses = 2; }],
    ['resolution', result => { result.atBat.resolution = 'give_up'; }],
  ];
  it.each(metadataChanges)('compares %s rather than silently accepting changed payload', async (_, change) => {
    const repository = new Repository();
    const service = createDailyAtBatResultService(repository);
    const first = observation();
    await service.store(first);
    const changed = observation();
    change(changed); // Some are intentionally unvalidated to isolate semantic comparison.
    expect(await service.store(changed)).toMatchObject({ ok: false, error: 'idempotency_conflict' });
    expect(repository.rows).toEqual([first]);
  });

  const keyChanges: [string, (result: DailyAtBatResult) => void][] = [
    ['attempt', result => { result.attemptId = 'attempt-2'; }],
    ['puzzle version', result => { result.puzzleId = 'puzzle-version-2'; }],
    ['slot', result => { result.atBat.pitchNumber = 1; }],
    ['ruleset', result => { (result as { rulesetVersion: string }).rulesetVersion = 'future-ruleset'; }],
  ];
  it.each(keyChanges)('keeps different %s keys independent', async (_, change) => {
    const repository = new Repository();
    const service = createDailyAtBatResultService(repository);
    const next = observation();
    change(next); // Unsupported future ruleset checks repository-key isolation only.
    await service.store(observation());
    expect(await service.store(next)).toMatchObject({ ok: true, status: 'created' });
    expect(repository.rows).toHaveLength(2);
  });

  it.each(keyChanges)('rejects a provider returning another %s key', async (_, change) => {
    const wrong = observation();
    change(wrong);
    for (const status of ['inserted', 'existing'] as const) {
      const service = createDailyAtBatResultService({ insertIfAbsent: async () => ({ status, result: wrong }) });
      await expect(service.store(observation())).rejects.toThrow('different observation key');
    }
  });

  it('rejects mismatched insertion and propagates provider failure for transport retry policy', async () => {
    const wrong = { ...observation(), awardedPoints: 6 };
    const broken = createDailyAtBatResultService({ insertIfAbsent: async () => ({ status: 'inserted', result: wrong }) });
    await expect(broken.store(observation())).rejects.toThrow('different inserted result');
    const failure = new Error('provider unavailable');
    const unavailable = createDailyAtBatResultService({ insertIfAbsent: async () => { throw failure; } });
    await expect(unavailable.store(observation())).rejects.toBe(failure);
  });
});
