import type { DailyCompletedResult } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  createDailyCompletedResultService,
  type DailyCompletedResultRepository,
  type DailyCompletedResultRepositoryInsertResult,
} from './dailyCompletedResultService';

type PointsCompletedResult = Extract<DailyCompletedResult, { rulesetVersion: 'points-v3' }>;
type ClassicCompletedResult = Extract<DailyCompletedResult, { rulesetVersion: 'classic-inning-v1' }>;

describe('Daily completed-result service', () => {
  it('stores the first normalized result once and preserves its raw facts', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const result = buildPointsResult();

    const stored = await service.store(result);

    expect(stored).toEqual({ ok: true, status: 'created', result });
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]).toEqual(result);
    expect(repository.records[0]?.completedAtBats).toEqual(result.completedAtBats);
  });

  it('returns the existing result for an identical retry without creating another record', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const result = buildPointsResult();

    await service.store(result);
    const retry = await service.store(result);

    expect(retry).toEqual({ ok: true, status: 'existing', result });
    expect(repository.records).toHaveLength(1);
  });

  it('treats a deep-equivalent normalized payload as the same idempotent retry', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const first = buildPointsResult();
    const equivalent = buildPointsResult();

    await service.store(first);
    const retry = await service.store(equivalent);

    expect(retry).toEqual({ ok: true, status: 'existing', result: first });
    expect(repository.records).toHaveLength(1);
  });

  it('collapses concurrent identical retries to one stored result', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const result = buildPointsResult('concurrent-same');

    const outcomes = await Promise.all([
      service.store(result),
      service.store(buildPointsResult('concurrent-same')),
    ]);

    expect(outcomes).toContainEqual({ ok: true, status: 'created', result });
    expect(outcomes).toContainEqual({ ok: true, status: 'existing', result });
    expect(repository.records).toEqual([result]);
  });

  it('returns one conflict when concurrent callers reuse an ID with different payloads', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const first = buildPointsResult('concurrent-conflict');
    const changed = buildPointsResult('concurrent-conflict');
    changed.summary = { ...changed.summary, points: changed.summary.points - 1 };

    const outcomes = await Promise.all([
      service.store(first),
      service.store(changed),
    ]);

    expect(outcomes).toContainEqual({ ok: true, status: 'created', result: first });
    expect(outcomes).toContainEqual({
      ok: false,
      error: 'idempotency_conflict',
      submissionId: 'concurrent-conflict',
    });
    expect(repository.records).toEqual([first]);
  });

  it('conflicts when the same submission ID carries different raw at-bat facts', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const first = buildPointsResult();
    const changed = buildPointsResult();
    changed.completedAtBats[0] = {
      ...changed.completedAtBats[0]!,
      wrongGuesses: 1,
    };

    await service.store(first);
    const conflict = await service.store(changed);

    expect(conflict).toEqual({
      ok: false,
      error: 'idempotency_conflict',
      submissionId: first.submissionId,
    });
    expect(repository.records).toEqual([first]);
  });

  it('conflicts when the same submission ID carries a different derived summary', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const first = buildPointsResult();
    const changed = buildPointsResult();
    changed.summary = { ...changed.summary, points: changed.summary.points - 1 };

    await service.store(first);
    const conflict = await service.store(changed);

    expect(conflict.ok).toBe(false);
    expect(repository.records).toEqual([first]);
  });

  it('conflicts when the same submission ID is reused for another game', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const dailyNine = buildPointsResult('shared-id');
    const classic = buildClassicResult('shared-id');

    await service.store(dailyNine);
    const conflict = await service.store(classic);

    expect(conflict).toEqual({
      ok: false,
      error: 'idempotency_conflict',
      submissionId: 'shared-id',
    });
    expect(repository.records).toEqual([dailyNine]);
  });

  it('allows the same normalized game payload under a different submission ID', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);

    const first = await service.store(buildPointsResult('submission-1'));
    const second = await service.store(buildPointsResult('submission-2'));

    expect(first.ok && first.status).toBe('created');
    expect(second.ok && second.status).toBe('created');
    expect(repository.records.map(record => record.submissionId)).toEqual([
      'submission-1',
      'submission-2',
    ]);
  });

  it('preserves the shorter faced-at-bat fact list for a completed Classic result', async () => {
    const repository = new InMemoryDailyCompletedResultRepository();
    const service = createDailyCompletedResultService(repository);
    const result = buildClassicResult();

    const stored = await service.store(result);

    expect(stored).toEqual({ ok: true, status: 'created', result });
    expect(repository.records[0]?.completedAtBats).toHaveLength(3);
    expect(repository.records[0]?.summary).toEqual(result.summary);
  });

  it('fails loudly if a repository claims insertion but returns a different record', async () => {
    const incoming = buildPointsResult();
    const repository: DailyCompletedResultRepository = {
      async insertIfAbsent(): Promise<DailyCompletedResultRepositoryInsertResult> {
        return {
          status: 'inserted',
          result: buildPointsResult('different-id'),
        };
      },
    };
    const service = createDailyCompletedResultService(repository);

    await expect(service.store(incoming)).rejects.toThrow(
      'repository returned a different inserted result',
    );
  });
});

class InMemoryDailyCompletedResultRepository implements DailyCompletedResultRepository {
  readonly records: DailyCompletedResult[] = [];

  async insertIfAbsent(
    result: DailyCompletedResult,
  ): Promise<DailyCompletedResultRepositoryInsertResult> {
    const existing = this.records.find(record => record.submissionId === result.submissionId);
    if (existing) return { status: 'existing', result: existing };

    this.records.push(result);
    return { status: 'inserted', result };
  }
}

function buildPointsResult(submissionId = 'submission-1'): PointsCompletedResult {
  return {
    schemaVersion: 1,
    submissionId,
    puzzleId: 'daily-2026-09-16-editorial-8fed8bb1',
    puzzleDate: '2026-09-16',
    puzzleNumber: 143,
    rulesetVersion: 'points-v3',
    completedAtBats: [
      completedAtBat(1, 'AA', 'HR', 0, 0, 'correct'),
      completedAtBat(2, 'BB', '3B', 1, 0, 'correct'),
      completedAtBat(3, 'CC', '2B', 2, 0, 'correct'),
      completedAtBat(4, 'DD', '1B', 3, 0, 'correct'),
      completedAtBat(5, 'EE', 'BB', 4, 0, 'correct'),
      completedAtBat(6, 'FF', 'HR', 0, 1, 'correct'),
      completedAtBat(7, 'GG', '3B', 1, 1, 'correct'),
      completedAtBat(8, 'HH', 'K', 2, 3, 'strikeout'),
      completedAtBat(9, 'II', 'K', 0, 0, 'give_up'),
    ],
    summary: {
      points: 36,
      maximumPoints: 63,
      atBatsCompleted: 9,
      totalAtBats: 9,
      completed: true,
      strikeouts: 2,
    },
  };
}

function buildClassicResult(submissionId = 'classic-submission-1'): ClassicCompletedResult {
  return {
    schemaVersion: 1,
    submissionId,
    puzzleId: 'daily-2026-09-16-editorial-8fed8bb1',
    puzzleDate: '2026-09-16',
    puzzleNumber: 143,
    rulesetVersion: 'classic-inning-v1',
    completedAtBats: [
      completedAtBat(1, 'AA', 'K', 0, 3, 'strikeout'),
      completedAtBat(2, 'BB', 'K', 1, 3, 'strikeout'),
      completedAtBat(3, 'CC', 'K', 2, 3, 'strikeout'),
    ],
    summary: {
      runs: 0,
      hits: 0,
      outs: 3,
      strikeouts: 3,
      completed: true,
      atBatsCompleted: 3,
      totalAtBats: 9,
    },
  };
}

function completedAtBat(
  pitchNumber: number,
  initials: string,
  outcome: 'HR' | '3B' | '2B' | '1B' | 'BB' | 'K',
  hintsRevealed: 0 | 1 | 2 | 3 | 4,
  wrongGuesses: number,
  resolution: 'correct' | 'strikeout' | 'give_up',
) {
  return {
    pitchNumber,
    initials,
    outcome,
    hintsRevealed,
    wrongGuesses,
    resolution,
  } as const;
}
