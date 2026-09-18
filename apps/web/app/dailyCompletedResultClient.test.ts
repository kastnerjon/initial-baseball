import {
  CLASSIC_DAILY_RULESET_VERSION,
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

const AT_BATS: DailyCompletedAtBat[] = Array.from({ length: 9 }, (_, index) => ({
  pitchNumber: index + 1,
  initials: `P${index + 1}`,
  outcome: 'HR',
  hintsRevealed: 0,
  wrongGuesses: 0,
  resolution: 'correct',
}));

describe('completed-result browser client', () => {
  it('persists one submission ID before posting and marks success submitted', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'submission-one',
      submitRequest,
    });

    await expect(client.submitIfNeeded(pointsInput())).resolves.toBe('submitted');

    expect(submitRequest).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 1,
      submissionId: 'submission-one',
      puzzleId: PUZZLE.id,
      puzzleDate: PUZZLE.puzzleDate,
      puzzleNumber: PUZZLE.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedAtBats: AT_BATS,
    }));
    expect(storage.values()[0]).toContain('"status":"submitted"');
  });

  it('deduplicates concurrent calls for the same game identity', async () => {
    const request = deferred<{ ok: boolean; status: number }>();
    const submitRequest = vi.fn(() => request.promise);
    const client = createDailyCompletedResultClient({
      storage: memoryStorage(),
      createSubmissionId: () => 'single-flight-id',
      submitRequest,
    });

    const first = client.submitIfNeeded(pointsInput());
    const second = client.submitIfNeeded(pointsInput());

    expect(submitRequest).toHaveBeenCalledTimes(1);
    request.resolve({ ok: true, status: 201 });
    await expect(Promise.all([first, second])).resolves.toEqual(['submitted', 'submitted']);
  });

  it('retries transient failure with the same stored submission ID', async () => {
    const storage = memoryStorage();
    const createSubmissionId = vi.fn(() => 'stable-retry-id');
    const submitRequest = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const client = createDailyCompletedResultClient({ storage, createSubmissionId, submitRequest });

    await expect(client.submitIfNeeded(pointsInput())).resolves.toBe('pending');
    await expect(client.submitIfNeeded(pointsInput())).resolves.toBe('submitted');

    expect(createSubmissionId).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledTimes(2);
    expect(submitRequest.mock.calls[0]?.[0].submissionId).toBe('stable-retry-id');
    expect(submitRequest.mock.calls[1]?.[0].submissionId).toBe('stable-retry-id');
  });

  it('keeps 5xx pending but makes conflict and ordinary 4xx terminal', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 409 });
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'terminal-id',
      submitRequest,
    });

    await expect(client.submitIfNeeded(pointsInput())).resolves.toBe('pending');
    await expect(client.submitIfNeeded(pointsInput())).resolves.toBe('conflict');
    await expect(client.submitIfNeeded(pointsInput())).resolves.toBe('conflict');
    expect(submitRequest).toHaveBeenCalledTimes(2);

    client.clear(pointsInput());
    const rejectedClient = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'rejected-id',
      submitRequest: vi.fn().mockResolvedValue({ ok: false, status: 400 }),
    });
    await expect(rejectedClient.submitIfNeeded(pointsInput())).resolves.toBe('rejected');
  });

  it('does not recreate a marker when reset happens during an in-flight request', async () => {
    const storage = memoryStorage();
    const request = deferred<{ ok: boolean; status: number }>();
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'reset-race-id',
      submitRequest: vi.fn(() => request.promise),
    });

    const pending = client.submitIfNeeded(pointsInput());
    expect(storage.values()[0]).toContain('reset-race-id');

    client.clear(pointsInput());
    expect(storage.values()).toEqual([]);

    request.resolve({ ok: true, status: 201 });
    await expect(pending).resolves.toBe('pending');
    expect(storage.values()).toEqual([]);
  });

  it('cannot let an old response overwrite a new marker created after reset', async () => {
    const storage = memoryStorage();
    const firstRequest = deferred<{ ok: boolean; status: number }>();
    const secondRequest = deferred<{ ok: boolean; status: number }>();
    const submitRequest = vi.fn()
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);
    const ids = ['old-id', 'new-id'];
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => ids.shift() ?? null,
      submitRequest,
    });

    const oldPending = client.submitIfNeeded(pointsInput());
    client.clear(pointsInput());
    const newPending = client.submitIfNeeded(pointsInput());

    expect(storage.values()[0]).toContain('"submissionId":"new-id"');
    firstRequest.resolve({ ok: true, status: 201 });
    await oldPending;
    expect(storage.values()[0]).toContain('"submissionId":"new-id"');
    expect(storage.values()[0]).toContain('"status":"pending"');

    secondRequest.resolve({ ok: true, status: 201 });
    await expect(newPending).resolves.toBe('submitted');
    expect(storage.values()[0]).toContain('"submissionId":"new-id"');
    expect(storage.values()[0]).toContain('"status":"submitted"');
  });

  it('never submits compatibility rulesets', async () => {
    const submitRequest = vi.fn();
    const client = createDailyCompletedResultClient({
      storage: memoryStorage(),
      createSubmissionId: () => 'unused-id',
      submitRequest,
    });

    await expect(client.submitIfNeeded({
      ...pointsInput(),
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    })).resolves.toBe('unsupported');

    expect(submitRequest).not.toHaveBeenCalled();
  });

  it('preserves only faced at-bats for Classic and clears independently', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createDailyCompletedResultClient({
      storage,
      createSubmissionId: () => 'classic-id',
      submitRequest,
    });
    const classicAtBats = AT_BATS.slice(0, 3).map(atBat => ({
      ...atBat,
      outcome: 'K' as const,
      wrongGuesses: 3,
      resolution: 'strikeout' as const,
    }));
    const input = {
      puzzle: PUZZLE,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      completedAtBats: classicAtBats,
    };

    await expect(client.submitIfNeeded(input)).resolves.toBe('submitted');
    expect(submitRequest.mock.calls[0]?.[0].completedAtBats).toHaveLength(3);

    client.clear(input);
    expect(storage.values()).toEqual([]);
  });
});

function pointsInput() {
  return {
    puzzle: PUZZLE,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    completedAtBats: AT_BATS,
  };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    values: () => [...map.values()],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => { resolve = resolver; });
  return { promise, resolve };
}
