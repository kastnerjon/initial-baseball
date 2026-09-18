import {
  CLASSIC_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyCompletedResultClient } from './dailyCompletedResultClient';

const PUZZLE = { id: 'daily-2026-09-17-editorial-v1', puzzleDate: '2026-09-17', puzzleNumber: 144 };
const AT_BATS: DailyCompletedAtBat[] = Array.from({ length: 9 }, (_, index) => ({
  pitchNumber: index + 1,
  initials: `P${index + 1}`,
  outcome: 'HR',
  hintsRevealed: 0,
  wrongGuesses: 0,
  resolution: 'correct',
}));

describe('completed-result browser delivery', () => {
  it('persists the exact payload before POST and marks success terminal', async () => {
    const storage = memoryStorage();
    const request = vi.fn().mockImplementation(async () => {
      expect(storage.values()[0]).toContain('"status":"pending"');
      expect(storage.values()[0]).toContain('"submissionId":"stable-id"');
      return { ok: true, status: 201 };
    });
    const client = createClient(storage, request, () => 'stable-id');

    await expect(submit(client)).resolves.toBe('submitted');

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: 'stable-id',
      puzzleId: PUZZLE.id,
      completedAtBats: AT_BATS,
    }));
    expect(storage.values()[0]).toContain('"status":"submitted"');
  });

  it('retries the immutable stored payload with the same ID after failure', async () => {
    const storage = memoryStorage();
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const createId = vi.fn(() => 'retry-id');
    const client = createClient(storage, request, createId);

    await expect(submit(client)).resolves.toBe('pending');
    const changed = pointsInput();
    changed.completedAtBats[0] = { ...changed.completedAtBats[0]!, hintsRevealed: 1, outcome: '3B' };
    await expect(submit(client, changed)).resolves.toBe('submitted');

    expect(createId).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[1]?.[0]).toEqual(request.mock.calls[0]?.[0]);
  });

  it('deduplicates concurrent effects into one in-flight POST', async () => {
    const pending = deferred<{ ok: boolean; status: number }>();
    const request = vi.fn(() => pending.promise);
    const client = createClient(memoryStorage(), request, () => 'one-flight');
    const first = submit(client);
    const second = submit(client);

    expect(request).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: true, status: 201 });
    await expect(Promise.all([first, second])).resolves.toEqual(['submitted', 'submitted']);
  });

  it('does not create a marker retroactively, but retries an existing pending marker after refresh', async () => {
    const storage = memoryStorage();
    const createId = vi.fn(() => 'persisted-id');
    const offline = createClient(storage, vi.fn().mockRejectedValue(new Error('offline')), createId);

    await expect(submit(offline, pointsInput(), false)).resolves.toBe('not_started');
    expect(createId).not.toHaveBeenCalled();
    await expect(submit(offline)).resolves.toBe('pending');

    const refreshedId = vi.fn(() => 'wrong-new-id');
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const refreshed = createClient(storage, request, refreshedId);
    await expect(submit(refreshed, pointsInput(), false)).resolves.toBe('submitted');

    expect(refreshedId).not.toHaveBeenCalled();
    expect(request.mock.calls[0]?.[0].submissionId).toBe('persisted-id');
  });

  it.each([408, 425, 429, 500, 503])('keeps HTTP %i retryable', async (status) => {
    const client = createClient(
      memoryStorage(),
      vi.fn().mockResolvedValue({ ok: false, status }),
      () => `retry-${status}`,
    );
    await expect(submit(client)).resolves.toBe('pending');
  });

  it.each([[409, 'conflict'], [400, 'rejected'], [422, 'rejected']] as const)(
    'makes HTTP %i terminal as %s',
    async (status, expected) => {
      const request = vi.fn().mockResolvedValue({ ok: false, status });
      const client = createClient(memoryStorage(), request, () => `terminal-${status}`);
      await expect(submit(client)).resolves.toBe(expected);
      await expect(submit(client)).resolves.toBe(expected);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('does not let a stale response overwrite another stored submission ID', async () => {
    const storage = memoryStorage();
    const pending = deferred<{ ok: boolean; status: number }>();
    const client = createClient(storage, vi.fn(() => pending.promise), () => 'old-id');
    const result = submit(client);

    const [key, raw] = storage.entries()[0]!;
    const record = JSON.parse(raw) as { submission: { submissionId: string }; status: string };
    record.submission.submissionId = 'replacement-id';
    storage.setItem(key, JSON.stringify(record));

    pending.resolve({ ok: true, status: 201 });
    await expect(result).resolves.toBe('pending');
    expect(storage.values()[0]).toContain('"submissionId":"replacement-id"');
    expect(storage.values()[0]).toContain('"status":"pending"');
  });

  it('keeps one browser contribution across replay and preserves Classic faced at-bats', async () => {
    const storage = memoryStorage();
    const request = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = createClient(storage, request, () => 'first-completion');
    await submit(client);

    const replay = pointsInput();
    replay.completedAtBats[0] = { ...replay.completedAtBats[0]!, wrongGuesses: 1, outcome: '3B' };
    await expect(submit(client, replay)).resolves.toBe('submitted');
    expect(request).toHaveBeenCalledTimes(1);

    const classicRequest = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const classicClient = createClient(memoryStorage(), classicRequest, () => 'classic-id');
    await submit(classicClient, {
      puzzle: PUZZLE,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      completedAtBats: AT_BATS.slice(0, 3).map(atBat => ({
        ...atBat, outcome: 'K', wrongGuesses: 3, resolution: 'strikeout',
      })),
    });
    expect(classicRequest.mock.calls[0]?.[0].completedAtBats).toHaveLength(3);
  });

  it('never submits compatibility rulesets', async () => {
    const request = vi.fn();
    const client = createClient(memoryStorage(), request, () => 'unused');
    await expect(submit(
      client,
      { ...pointsInput(), rulesetVersion: LEGACY_DAILY_RULESET_VERSION },
    )).resolves.toBe('unsupported');
    expect(request).not.toHaveBeenCalled();
  });
});

function pointsInput() {
  return {
    puzzle: PUZZLE,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    completedAtBats: AT_BATS.map(atBat => ({ ...atBat })),
  };
}
function submit(
  client: ReturnType<typeof createDailyCompletedResultClient>,
  input = pointsInput(),
  allowCreate = true,
) {
  return client.submitIfNeeded(input, { allowCreate });
}
function createClient(
  storage: ReturnType<typeof memoryStorage>,
  submitRequest: ReturnType<typeof vi.fn>,
  createSubmissionId: () => string | null,
) {
  return createDailyCompletedResultClient({ storage, submitRequest, createSubmissionId });
}
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    values: () => [...values.values()],
    entries: () => [...values.entries()],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
