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
  it('persists the exact payload and ID before first POST', async () => {
    const storage = memoryStorage();
    const request = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = makeClient(storage, request, () => 'submission-one');

    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe('submitted');

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      schemaVersion: 1,
      submissionId: 'submission-one',
      puzzleId: PUZZLE.id,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      completedAtBats: AT_BATS,
    });
    expect(storage.record()).toMatchObject({
      status: 'submitted',
      submission: { submissionId: 'submission-one', completedAtBats: AT_BATS },
    });
  });

  it('deduplicates concurrent delivery in one tab', async () => {
    const storage = memoryStorage();
    const pending = deferred<{ ok: boolean; status: number }>();
    const request = vi.fn(() => pending.promise);
    const client = makeClient(storage, request, () => 'single-flight');

    const first = client.submitIfNeeded(pointsInput(), { allowCreate: true });
    const second = client.submitIfNeeded(pointsInput(), { allowCreate: true });
    expect(request).toHaveBeenCalledTimes(1);

    pending.resolve({ ok: true, status: 201 });
    await expect(Promise.all([first, second])).resolves.toEqual(['submitted', 'submitted']);
  });

  it('refresh retry reuses the exact pending payload and never mints a new ID', async () => {
    const storage = memoryStorage();
    const first = makeClient(
      storage,
      vi.fn().mockRejectedValue(new Error('offline')),
      () => 'stable-id',
    );
    await expect(first.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe('pending');

    const createId = vi.fn(() => 'wrong-new-id');
    const retryRequest = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const retry = makeClient(storage, retryRequest, createId);
    const changedInput = pointsInput();
    changedInput.completedAtBats = changedInput.completedAtBats.map((atBat, index) => (
      index === 0 ? { ...atBat, hintsRevealed: 1, outcome: '3B' } : atBat
    ));

    await expect(retry.submitIfNeeded(changedInput, { allowCreate: false }))
      .resolves.toBe('submitted');

    expect(createId).not.toHaveBeenCalled();
    expect(retryRequest.mock.calls[0]?.[0].submissionId).toBe('stable-id');
    expect(retryRequest.mock.calls[0]?.[0].completedAtBats).toEqual(AT_BATS);
  });

  it('does not retroactively create a submission when no marker exists', async () => {
    const request = vi.fn();
    const createId = vi.fn(() => 'unused');
    const client = makeClient(memoryStorage(), request, createId);

    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: false }))
      .resolves.toBe('not_started');
    expect(createId).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [503, 'pending'],
    [429, 'pending'],
    [409, 'conflict'],
    [400, 'rejected'],
  ] as const)('classifies HTTP %s as %s', async (status, expected) => {
    const client = makeClient(
      memoryStorage(),
      vi.fn().mockResolvedValue({ ok: false, status }),
      () => `status-${status}`,
    );
    await expect(client.submitIfNeeded(pointsInput(), { allowCreate: true }))
      .resolves.toBe(expected);
  });

  it('stale async response cannot overwrite a different stored submission ID', async () => {
    const storage = memoryStorage();
    const pending = deferred<{ ok: boolean; status: number }>();
    const client = makeClient(storage, vi.fn(() => pending.promise), () => 'old-id');
    const oldFlight = client.submitIfNeeded(pointsInput(), { allowCreate: true });

    const replacement = storage.record();
    replacement.submission.submissionId = 'new-id';
    replacement.status = 'submitted';
    storage.replace(replacement);

    pending.resolve({ ok: true, status: 201 });
    await expect(oldFlight).resolves.toBe('submitted');
    expect(storage.record()).toMatchObject({
      status: 'submitted',
      submission: { submissionId: 'new-id' },
    });
  });

  it('never submits compatibility rulesets and preserves shorter Classic facts', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = makeClient(memoryStorage(), request, () => 'game-id');

    await expect(client.submitIfNeeded({
      ...pointsInput(),
      rulesetVersion: LEGACY_DAILY_RULESET_VERSION,
    }, { allowCreate: true })).resolves.toBe('unsupported');
    expect(request).not.toHaveBeenCalled();

    const classic = AT_BATS.slice(0, 3).map(atBat => ({
      ...atBat,
      outcome: 'K' as const,
      wrongGuesses: 3,
      resolution: 'strikeout' as const,
    }));
    await expect(client.submitIfNeeded({
      puzzle: PUZZLE,
      rulesetVersion: CLASSIC_DAILY_RULESET_VERSION,
      completedAtBats: classic,
    }, { allowCreate: true })).resolves.toBe('submitted');
    expect(request.mock.calls[0]?.[0].completedAtBats).toEqual(classic);
  });
});

function pointsInput() {
  return {
    puzzle: PUZZLE,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    completedAtBats: AT_BATS.map(atBat => ({ ...atBat })),
  };
}

function makeClient(
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
    record: () => JSON.parse([...map.values()][0] ?? '{}'),
    replace: (value: unknown) => {
      const key = [...map.keys()][0];
      if (key !== undefined) map.set(key, JSON.stringify(value));
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
