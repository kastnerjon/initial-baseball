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

describe('completed-result browser delivery', () => {
  it('persists the exact payload before POST and marks a successful submission terminal', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn().mockImplementation(async (submission) => {
      expect(storage.values()[0]).toContain('"status":"pending"');
      expect(storage.values()[0]).toContain('"submissionId":"stable-id"');
      return { ok: true, status: 201 };
    });
    const client = createClient(storage, submitRequest, () => 'stable-id');

    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe('submitted');

    expect(submitRequest).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: 'stable-id',
      puzzleId: PUZZLE.id,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedAtBats: AT_BATS,
    }));
    expect(storage.values()[0]).toContain('"status":"submitted"');
  });

  it('retries the immutable stored payload with the same ID even if replay facts differ', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const createSubmissionId = vi.fn(() => 'retry-id');
    const client = createClient(storage, submitRequest, createSubmissionId);

    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe('pending');

    const changed = pointsInput();
    changed.completedAtBats = changed.completedAtBats.map((atBat, index) => (
      index === 0 ? { ...atBat, hintsRevealed: 1 as const, outcome: '3B' as const } : atBat
    ));
    await expect(client.submitIfNeeded(changed, { allowCreate: true }))
      .resolves.toBe('submitted');

    expect(createSubmissionId).toHaveBeenCalledTimes(1);
    expect(submitRequest).toHaveBeenCalledTimes(2);
    expect(submitRequest.mock.calls[1]?.[0]).toEqual(submitRequest.mock.calls[0]?.[0]);
  });

  it('deduplicates concurrent effects into one in-flight POST', async () => {
    const storage = memoryStorage();
    const response = deferred<{ ok: boolean; status: number }>();
    const submitRequest = vi.fn(() => response.promise);
    const client = createClient(storage, submitRequest, () => 'one-flight');

    const first = client.submitIfNeeded(pointsInput(), { allowCreate: true });
    const second = client.submitIfNeeded(pointsInput(), { allowCreate: true });

    expect(submitRequest).toHaveBeenCalledTimes(1);
    response.resolve({ ok: true, status: 201 });
    await expect(Promise.all([first, second])).resolves.toEqual(['submitted', 'submitted']);
  });

  it('does not retroactively create a marker for a restored completion', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn();
    const createSubmissionId = vi.fn(() => 'should-not-exist');
    const client = createClient(storage, submitRequest, createSubmissionId);

    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: false }))
      .resolves.toBe('not_started');

    expect(createSubmissionId).not.toHaveBeenCalled();
    expect(submitRequest).not.toHaveBeenCalled();
    expect(storage.values()).toEqual([]);
  });

  it('retries an existing pending marker after refresh without creating a new ID', async () => {
    const storage = memoryStorage();
    const first = createClient(
      storage,
      vi.fn().mockRejectedValue(new Error('offline')),
      () => 'persisted-id',
    );
    await first.submitIfNeeded(pointsInput(), { allowCreate: true });

    const createSubmissionId = vi.fn(() => 'wrong-new-id');
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const refreshed = createClient(storage, submitRequest, createSubmissionId);

    await expect(refreshed.submitIfNeeded(pointsInput(), { allowCreate: false }))
      .resolves.toBe('submitted');

    expect(createSubmissionId).not.toHaveBeenCalled();
    expect(submitRequest.mock.calls[0]?.[0].submissionId).toBe('persisted-id');
  });

  it.each([408, 425, 429, 500, 503])(
    'keeps HTTP %i retryable as pending',
    async (status) => {
      const client = createClient(
        memoryStorage(),
        vi.fn().mockResolvedValue({ ok: false, status }),
        () => `retry-${status}`,
      );
      await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
        .resolves.toBe('pending');
    },
  );

  it.each([
    [409, 'conflict'],
    [400, 'rejected'],
    [422, 'rejected'],
  ] as const)('makes HTTP %i terminal as %s', async (status, expected) => {
    const submitRequest = vi.fn().mockResolvedValue({ ok: false, status });
    const client = createClient(memoryStorage(), submitRequest, () => `terminal-${status}`);

    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe(expected);
    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe(expected);
    expect(submitRequest).toHaveBeenCalledTimes(1);
  });

  it('does not let an old async response overwrite a different stored submission ID', async () => {
    const storage = memoryStorage();
    const response = deferred<{ ok: boolean; status: number }>();
    const client = createClient(storage, vi.fn(() => response.promise), () => 'old-id');

    const request = client.submitIfNeeded(pointsInput(), { allowCreate: true });
    const [key, raw] = storage.entries()[0]!;
    const record = JSON.parse(raw) as {
      status: string;
      submission: { submissionId: string };
    };
    record.submission.submissionId = 'replacement-id';
    storage.setItem(key, JSON.stringify(record));

    response.resolve({ ok: true, status: 201 });
    await expect(request).resolves.toBe('pending');
    expect(storage.values()[0]).toContain('"submissionId":"replacement-id"');
    expect(storage.values()[0]).toContain('"status":"pending"');
  });

  it('keeps one terminal browser contribution across replay attempts', async () => {
    const storage = memoryStorage();
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createClient(storage, submitRequest, () => 'first-completion');

    await client.submitIfNeeded(pointsInput(), { allowCreate: true });
    const replay = pointsInput();
    replay.completedAtBats = replay.completedAtBats.map(atBat => ({
      ...atBat,
      wrongGuesses: 1,
      outcome: '3B' as const,
    }));

    await expect(client.submitIfNeeded(replay, { allowCreate: true }))
      .resolves.toBe('submitted');
    expect(submitRequest).toHaveBeenCalledTimes(1);
  });

  it('preserves Classic faced-at-bat length and rejects compatibility rulesets', async () => {
    const submitRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createClient(memoryStorage(), submitRequest, () => 'classic-id');
    const classic = {
      puzzle: PUZZLE,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      completedAtBats: AT_BATS.slice(0, 3).map(atBat => ({
        ...atBat,
        outcome: 'K' as const,
        wrongGuesses: 3,
        resolution: 'strikeout' as const,
      })),
    };

    await expect(client.submitIfNeeded(classic, { allowCreate: true }))
      .resolves.toBe('submitted');
    expect(submitRequest.mock.calls[0]?.[0].completedAtBats).toHaveLength(3);

    await expect(client.submitIfNeeded(
      { ...pointsInput(), rulesetVersion: LEGACY_DAILY_RULESET_VERSION },
      { allowCreate: true },
    )).resolves.toBe('unsupported');
    expect(submitRequest).toHaveBeenCalledTimes(1);
  });
});

function pointsInput() {
  return {
    puzzle: PUZZLE,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    completedAtBats: AT_BATS.map(atBat => ({ ...atBat })),
  };
}

function createClient(
  storage: ReturnType<typeof memoryStorage>,
  submitRequest: ReturnType<typeof vi.fn>,
  createSubmissionId: () => string | null,
) {
  return createDailyCompletedResultClient({ storage, submitRequest, createSubmissionId });
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    values: () => [...map.values()],
    entries: () => [...map.entries()],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => { resolve = resolver; });
  return { promise, resolve };
}
