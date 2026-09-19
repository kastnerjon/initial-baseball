import {
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyAtBatResultSubmission,
  type DailyCompletedAtBat,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createDailyAtBatAttemptJournalStore,
  type DailyAtBatAttemptIdentity,
} from './dailyAtBatAttemptJournal';
import { createDailyAtBatResultClient } from './dailyAtBatResultClient';

const IDENTITY: DailyAtBatAttemptIdentity = {
  id: 'daily-2026-09-18-editorial-v1', puzzleDate: '2026-09-18', puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
};

describe('resolved-at-bat browser journal and outbox', () => {
  it('keeps one attempt, fences generations, and never replaces a frozen slot', () => {
    const storage = memoryStorage();
    const ids = vi.fn(() => 'attempt-one');
    const store = createDailyAtBatAttemptJournalStore({ storage, createAttemptId: ids });
    expect(store.create(IDENTITY)).toBe('created');
    expect(store.create(IDENTITY)).toBe('existing');
    expect(ids).toHaveBeenCalledTimes(1);
    expect(store.advanceGeneration(IDENTITY)).toBe('updated');
    expect(store.appendObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) })).toBe('stale');
    expect(store.appendObservation({ identity: IDENTITY, generation: 2, atBat: atBat(1) })).toBe('created');
    expect(store.appendObservation({ identity: IDENTITY, generation: 2, atBat: atBat(1) })).toBe('existing');
    expect(store.appendObservation({
      identity: IDENTITY, generation: 2, atBat: { ...atBat(1), hintsRevealed: 1, outcome: '3B' },
    })).toBe('observation_conflict');
    const journal = validJournal(store);
    expect(journal).toMatchObject({
      version: 1, attemptId: 'attempt-one', generation: 2, contributionState: 'retired',
      observations: { 1: { delivery: 'pending', submission: { atBat: { outcome: 'HR' } } } },
    });
    expect(store.appendObservation({ identity: IDENTITY, generation: 2, atBat: atBat(2) })).toBe('retired');
  });

  it('retires explicitly without deleting a pending frozen observation', () => {
    const store = makeStore(memoryStorage());
    store.create(IDENTITY); store.appendObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });
    expect(store.retire(IDENTITY, 1)).toBe('updated');
    expect(validJournal(store)).toMatchObject({
      contributionState: 'retired', observations: { 1: { delivery: 'pending' } },
    });
  });

  it('fails closed for corrupt/unavailable storage and invalid IDs', () => {
    const storage = memoryStorage();
    const store = makeStore(storage);
    store.create(IDENTITY);
    storage.replace('{not-json');
    expect(store.read(IDENTITY)).toEqual({ kind: 'invalid' });
    expect(createDailyAtBatAttemptJournalStore({ storage: null, createAttemptId: () => 'unused' })
      .create(IDENTITY)).toBe('unavailable');
    expect(createDailyAtBatAttemptJournalStore({ storage: memoryStorage(), createAttemptId: () => 'bad id' })
      .create(IDENTITY)).toBe('unavailable');
  });

  it.each([
    [{ ok: false, status: 503 }, 'pending', 'active'],
    [{ ok: false, status: 429 }, 'pending', 'active'],
    [{ ok: false, status: 408 }, 'pending', 'active'],
    [{ ok: false, status: 425 }, 'pending', 'active'],
    [{ ok: false, status: 409 }, 'conflict', 'retired'],
    [{ ok: false, status: 400 }, 'rejected', 'retired'],
    [{ ok: true, status: 201 }, 'submitted', 'active'],
  ] as const)('persists before request and classifies %j as %s', async (
    response: { readonly ok: boolean; readonly status: number },
    expected: 'pending' | 'conflict' | 'rejected' | 'submitted',
    state: 'active' | 'retired',
  ) => {
    const storage = memoryStorage();
    const request = vi.fn(async (submission: DailyAtBatResultSubmission) => {
      expect(storage.record().observations['1']).toEqual({ submission, delivery: 'pending' });
      return response;
    });
    const client = makeClient(storage, request);
    client.establishAttempt(IDENTITY);
    client.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });
    await expect(ownerDelivery(client).deliverObservation(1)).resolves.toBe(expected);
    expect(storage.record()).toMatchObject({
      contributionState: state,
      observations: { 1: { delivery: expected, submission: { attemptId: 'attempt-one' } } },
    });
  });

  it('retries the exact stored payload without minting a replacement attempt', async () => {
    const storage = memoryStorage();
    const first = makeClient(storage, vi.fn().mockRejectedValue(new Error('offline')));
    first.establishAttempt(IDENTITY);
    first.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });
    await expect(ownerDelivery(first).deliverObservation(1)).resolves.toBe('pending');
    const frozen = JSON.stringify(storage.record().observations['1'].submission);
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const retry = makeClient(storage, request, () => 'wrong-new-id');
    await expect(ownerDelivery(retry).retryPending()).resolves.toEqual(['submitted']);
    expect(JSON.stringify(request.mock.calls[0]?.[0])).toBe(frozen);
  });

  it('single-flights one slot and ignores terminal responses from an old generation', async () => {
    const storage = memoryStorage();
    const pending = deferred<{ ok: boolean; status: number }>();
    const request = vi.fn(() => pending.promise);
    const client = makeClient(storage, request);
    client.establishAttempt(IDENTITY);
    client.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });
    const delivery = ownerDelivery(client);
    const first = delivery.deliverObservation(1);
    const second = delivery.deliverObservation(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(client.advanceGeneration(IDENTITY)).toBe('updated');
    pending.resolve({ ok: true, status: 201 });
    await expect(Promise.all([first, second])).resolves.toEqual(['stale', 'stale']);
    expect(storage.record()).toMatchObject({ generation: 2, observations: { 1: { delivery: 'pending' } } });
  });

  it('retries pending slots once in pitch order and never sends an unfrozen slot', async () => {
    const storage = memoryStorage();
    const request = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const client = makeClient(storage, request);
    client.establishAttempt(IDENTITY);
    client.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(2) });
    client.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });
    await expect(ownerDelivery(client).deliverObservation(1)).resolves.toBe('submitted');
    request.mockClear();
    await expect(ownerDelivery(client).retryPending()).resolves.toEqual(['submitted']);
    expect(request.mock.calls[0]?.[0].atBat.pitchNumber).toBe(2);
    await expect(ownerDelivery(client).deliverObservation(3)).resolves.toBe('not_started');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops a disposed owner retry before it can adopt a successor generation', async () => {
    const storage = memoryStorage();
    const firstResponse = deferred<{ ok: boolean; status: number }>();
    const oldRequest = vi.fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValue({ ok: true, status: 201 });
    const oldClient = makeClient(storage, oldRequest);
    oldClient.establishAttempt(IDENTITY);
    oldClient.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });
    oldClient.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(2) });

    const oldOwner = ownerDelivery(oldClient);
    const retry = oldOwner.retryPending();
    expect(oldRequest).toHaveBeenCalledTimes(1);

    oldOwner.dispose();
    expect(oldClient.advanceGeneration(IDENTITY)).toBe('updated');
    expect(oldClient.freezeObservation({ identity: IDENTITY, generation: 2, atBat: atBat(3) }))
      .toBe('created');

    firstResponse.resolve({ ok: true, status: 201 });
    await expect(retry).resolves.toEqual(['stale']);
    expect(oldRequest).toHaveBeenCalledTimes(1);
    expect(storage.record()).toMatchObject({
      generation: 2,
      observations: {
        1: { delivery: 'pending' },
        2: { delivery: 'pending' },
        3: { delivery: 'pending' },
      },
    });

    const successorRequest = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const successor = makeClient(storage, successorRequest);
    await expect(ownerDelivery(successor).retryPending())
      .resolves.toEqual(['submitted', 'submitted', 'submitted']);
    expect(successorRequest).toHaveBeenCalledTimes(3);
  });

  it('keeps a late request error inert after owner disposal', async () => {
    const storage = memoryStorage();
    const response = deferred<{ ok: boolean; status: number }>();
    const request = vi.fn(() => response.promise);
    const client = makeClient(storage, request);
    client.establishAttempt(IDENTITY);
    client.freezeObservation({ identity: IDENTITY, generation: 1, atBat: atBat(1) });

    const owner = ownerDelivery(client);
    const delivery = owner.deliverObservation(1);
    owner.dispose();
    expect(client.advanceGeneration(IDENTITY)).toBe('updated');

    response.reject(new Error('offline'));
    await expect(delivery).resolves.toBe('stale');
    expect(storage.record()).toMatchObject({
      generation: 2,
      observations: { 1: { delivery: 'pending' } },
    });
  });
});

function makeStore(storage: ReturnType<typeof memoryStorage>) {
  return createDailyAtBatAttemptJournalStore({ storage, createAttemptId: () => 'attempt-one' });
}
function validJournal(store: ReturnType<typeof makeStore>) {
  const result = store.read(IDENTITY);
  if (result.kind !== 'valid') throw new Error('Expected valid journal, got ' + result.kind);
  return result.journal;
}
function makeClient(storage: ReturnType<typeof memoryStorage>, submitRequest: ReturnType<typeof vi.fn>,
  createAttemptId: () => string | null = () => 'attempt-one') {
  return createDailyAtBatResultClient({ storage, createAttemptId, submitRequest });
}
function ownerDelivery(client: ReturnType<typeof makeClient>) {
  const delivery = client.createOwnerDeliverySession(IDENTITY);
  if (delivery === null) throw new Error('Expected owner delivery session');
  return delivery;
}

function atBat(pitchNumber: number): DailyCompletedAtBat {
  return { pitchNumber, initials: 'P' + pitchNumber, outcome: 'HR', hintsRevealed: 0,
    wrongGuesses: 0, resolution: 'correct' };
}
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    record: () => JSON.parse([...map.values()][0] ?? '{}'),
    replace: (raw: string) => { const key = [...map.keys()][0]; if (key) map.set(key, raw); },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
