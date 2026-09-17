import {
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyCompletedResultClient } from './dailyCompletedResultClient';

const PUZZLE = {
  id: 'daily-2026-09-17-editorial-v1',
  puzzleDate: '2026-09-17',
  puzzleNumber: 144,
};

const COMPLETED_AT_BATS: DailyCompletedAtBat[] = Array.from({ length: 9 }, (_, index) => ({
  pitchNumber: index + 1,
  initials: `P${index + 1}`,
  outcome: 'HR' as const,
  hintsRevealed: 0 as const,
  wrongGuesses: 0,
  resolution: 'correct' as const,
}));

describe('completed-result browser submission client', () => {
  it('persists one submission ID before posting and marks a successful result submitted', async () => {
    const storage = createMemoryStorage();
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'submission-one',
      submitRequest,
    });

    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('submitted');

    expect(submitRequest).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 1,
      submissionId: 'submission-one',
      puzzleId: PUZZLE.id,
      puzzleDate: PUZZLE.puzzleDate,
      puzzleNumber: PUZZLE.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedAtBats: COMPLETED_AT_BATS,
    }));
    expect(storage.values()).toHaveLength(1);
    expect(storage.values()[0]).toContain('"status":"submitted"');
  });

  it('retries a transient failure with the same stored submission ID', async () => {
    const storage = createMemoryStorage();
    const createSubmissionId = vi.fn(() => 'stable-retry-id');
    const submitRequest = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const client = createDailyCompletedResultClient({ storage, createSubmissionId, submitRequest });

    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('pending');
    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('submitted');

    expect(createSubmissionId).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledTimes(2);
    const first = submitRequest.mock.calls[0]?.[0];
    const second = submitRequest.mock.calls[1]?.[0];
    expect(first?.submissionId).toBe('stable-retry-id');
    expect(second?.submissionId).toBe('stable-retry-id');
  });

  it('treats an idempotency conflict as terminal instead of minting another ID', async () => {
    const submitRequest = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    const createSubmissionId = vi.fn(() => 'conflict-id');
    const client = createDailyCompletedResultClient({
      storage: createMemoryStorage(),
      createSubmissionId,
      submitRequest,
    });

    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('conflict');
    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('conflict');

    expect(createSubmissionId).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledTimes(1);
  });

  it('leaves 5xx failures pending but makes ordinary 4xx rejection terminal', async () => {
    const storage = createMemoryStorage();
    const submitRequest = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 400 });
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'server-retry-id',
      submitRequest,
    });

    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('pending');
    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('rejected');
    await expect(client.submitIfNeeded(buildInput())).resolves.toBe('rejected');
    expect(submitRequest).toHaveBeenCalledTimes(2);
  });

  it('never submits compatibility rulesets reconstructed from older local saves', async () => {
    const submitRequest = vi.fn();
    const createSubmissionId = vi.fn(() => 'should-not-exist');
    const client = createDailyCompletedResultClient({
      storage: createMemoryStorage(),
      createSubmissionId,
      submitRequest,
    });

    await expect(client.submitIfNeeded({
      ...buildInput(),
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    })).resolves.toBe('unsupported');

    expect(createSubmissionId).not.toHaveBeenCalled();
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it('preserves a shorter Classic fact list and clears its marker independently', async () => {
    const storage = createMemoryStorage();
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'classic-id',
      submitRequest,
    });
    const classicAtBats = COMPLETED_AT_BATS.slice(0, 3).map(atBat => ({
      ...atBat,
      outcome: 'K' as const,
      wrongGuesses: 3,
      resolution: 'strikeout' as const,
    }));
    const classicInput = {
      puzzle: PUZZLE,
      rulesetVersion: 'classic-inning-v1' as const,
      completedAtBats: classicAtBats,
    };

    await expect(client.submitIfNeeded(classicInput)).resolves.toBe('submitted');
    expect(submitRequest.mock.calls[0]?.[0].completedAtBats).toHaveLength(3);

    client.clear(classicInput);
    expect(storage.values()).toEqual([]);
  });
});

function buildInput() {
  return {
    puzzle: PUZZLE,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    completedAtBats: COMPLETED_AT_BATS,
  };
}

function createMemoryStorage() {
  const valuesByKey = new Map<string, string>();
  return {
    getItem: (key: string) => valuesByKey.get(key) ?? null,
    setItem: (key: string, value: string) => { valuesByKey.set(key, value); },
    removeItem: (key: string) => { valuesByKey.delete(key); },
    values: () => [...valuesByKey.values()],
  };
}
