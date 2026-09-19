import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import type {
  DailyAtBatAttemptIdentity,
  DailyAtBatAttemptJournal,
  JournalMutationStatus,
  JournalRead,
} from './dailyAtBatAttemptJournal';
import {
  createDailyAtBatOwnershipCoordinator,
  getDailyAtBatOwnershipLockName,
  type DailyAtBatExclusiveLockPort,
  type DailyAtBatStorageSignalPort,
} from './dailyAtBatOwnershipCoordinator';

const IDENTITY: DailyAtBatAttemptIdentity = {
  id: 'daily-2026-09-18-editorial-v1',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
};

describe('Daily at-bat ownership coordinator', () => {
  it('queues simultaneous tabs under one exclusive puzzle/ruleset lock', async () => {
    const locks = new FakeLocks();
    const journal = memoryJournal();
    const first = makeCoordinator({ locks, journal });
    const second = makeCoordinator({ locks, journal });

    first.start(); second.start();
    await tick();

    expect(first.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: null });
    expect(second.getState()).toEqual({ status: 'follower' });
    expect(locks.names).toEqual([
      getDailyAtBatOwnershipLockName(IDENTITY),
      getDailyAtBatOwnershipLockName(IDENTITY),
    ]);

    first.stop(); await tick();
    expect(second.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: null });
    second.stop();
  });

  it('advances an existing journal generation on each queued takeover', async () => {
    const locks = new FakeLocks();
    const journal = memoryJournal({ attemptId: 'attempt-one', generation: 1 });
    const first = makeCoordinator({ locks, journal });
    const second = makeCoordinator({ locks, journal });

    first.start(); second.start(); await tick();
    expect(first.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: 2 });
    expect(journal.current()?.generation).toBe(2);

    first.stop(); await tick();
    expect(second.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: 3 });
    expect(journal.current()?.generation).toBe(3);
    second.stop();
  });

  it('reloads durable state before exposing owner readiness', async () => {
    const locks = new FakeLocks();
    const reload = deferred();
    const coordinator = makeCoordinator({
      locks,
      journal: memoryJournal(),
      reloadDurableState: () => reload.promise,
    });

    coordinator.start(); await tick();
    expect(coordinator.getState()).toEqual({ status: 'follower' });

    reload.resolve(); await tick();
    expect(coordinator.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: null });
    coordinator.stop();
  });

  it('releases a lock while reload is still pending and ignores the stale callback', async () => {
    const locks = new FakeLocks();
    const reload = deferred();
    const first = makeCoordinator({
      locks,
      journal: memoryJournal(),
      reloadDurableState: () => reload.promise,
    });
    const second = makeCoordinator({ locks, journal: memoryJournal() });

    first.start(); await tick();
    first.stop(); second.start(); await tick();
    expect(second.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: null });

    reload.resolve(); await tick();
    expect(first.getState()).toEqual({ status: 'follower' });
    second.stop();
  });

  it('treats storage events as notifications only', async () => {
    const locks = new FakeLocks();
    const signals = new FakeStorageSignals();
    const onStorageSignal = vi.fn();
    const first = makeCoordinator({ locks, journal: memoryJournal() });
    const second = makeCoordinator({
      locks, journal: memoryJournal(), storageSignals: signals, onStorageSignal,
    });

    first.start(); second.start(); await tick();
    expect(second.getState()).toEqual({ status: 'follower' });

    signals.fire('some-other-key');
    expect(onStorageSignal).toHaveBeenCalledWith('some-other-key');
    expect(second.getState()).toEqual({ status: 'follower' });
    first.stop(); second.stop();
  });

  it('fails closed without Web Locks', () => {
    const coordinator = createDailyAtBatOwnershipCoordinator({
      identity: IDENTITY, journal: memoryJournal(), lockPort: null,
      createAbortController: () => new AbortController(), reloadDurableState: () => {},
    });
    coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'unsupported', reason: 'locks_unavailable' });
    coordinator.stop();
  });

  it('fails closed without abortable queued-lock cleanup', () => {
    const coordinator = createDailyAtBatOwnershipCoordinator({
      identity: IDENTITY, journal: memoryJournal(), lockPort: new FakeLocks(),
      createAbortController: null, reloadDurableState: () => {},
    });
    coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'unsupported', reason: 'abort_unavailable' });
    coordinator.stop();
  });

  it('keeps corrupt-journal gameplay exclusive while contribution is disabled', async () => {
    const locks = new FakeLocks();
    const journal = {
      read: vi.fn((): JournalRead => ({ kind: 'invalid' })),
      advanceGeneration: vi.fn((): JournalMutationStatus => 'invalid'),
    };
    const first = makeCoordinator({ locks, journal });
    const second = makeCoordinator({ locks, journal });

    first.start(); second.start(); await tick();
    expect(first.getState()).toEqual({
      status: 'owner', contribution: 'disabled', generation: null, reason: 'journal_unavailable',
    });
    expect(second.getState()).toEqual({ status: 'follower' });

    first.stop(); await tick();
    expect(second.getState()).toEqual({
      status: 'owner', contribution: 'disabled', generation: null, reason: 'journal_unavailable',
    });
    second.stop();
  });

  it('recovers generation fencing only on a later ownership acquisition', async () => {
    const locks = new FakeLocks();
    const durable = memoryJournal({ attemptId: 'attempt-one', generation: 1 });
    let failGenerationWrite = true;
    const journal = {
      read: durable.read,
      advanceGeneration: (): JournalMutationStatus => failGenerationWrite
        ? 'unavailable'
        : durable.advanceGeneration(),
    };
    const first = makeCoordinator({ locks, journal });
    const second = makeCoordinator({ locks, journal });

    first.start(); second.start(); await tick();
    expect(first.getState()).toEqual({
      status: 'owner', contribution: 'disabled', generation: null, reason: 'journal_unavailable',
    });
    expect(second.getState()).toEqual({ status: 'follower' });
    expect(durable.current()?.generation).toBe(1);

    failGenerationWrite = false;
    await tick();
    expect(first.getState()).toMatchObject({ status: 'owner', contribution: 'disabled' });
    expect(durable.current()?.generation).toBe(1);

    first.stop(); await tick();
    expect(second.getState()).toEqual({ status: 'owner', contribution: 'enabled', generation: 2 });
    expect(durable.current()?.generation).toBe(2);
    second.stop();
  });

  it('holds the lock after durable reload failure until the failed owner stops', async () => {
    const locks = new FakeLocks();
    const journal = memoryJournal();
    const first = makeCoordinator({
      locks, journal, reloadDurableState: () => { throw new Error('reload failed'); },
    });
    const second = makeCoordinator({ locks, journal });

    first.start(); second.start(); await tick();
    expect(first.getState()).toEqual({ status: 'blocked', reason: 'owner_reload_failed' });
    expect(second.getState()).toEqual({ status: 'follower' });

    first.stop(); await tick();
    expect(second.getState()).toEqual({
      status: 'owner', contribution: 'enabled', generation: null,
    });
    second.stop();
  });

  it('blocks writes after an unexpected lock-request failure', async () => {
    const coordinator = createDailyAtBatOwnershipCoordinator({
      identity: IDENTITY,
      journal: memoryJournal(),
      lockPort: {
        async requestExclusive() { throw new Error('request failed'); },
      },
      createAbortController: () => new AbortController(),
      reloadDurableState: () => {},
    });

    coordinator.start(); await tick();
    expect(coordinator.getState()).toEqual({ status: 'blocked', reason: 'lock_request_failed' });
    coordinator.stop();
  });
});

function makeCoordinator({
  locks,
  journal,
  storageSignals = null,
  reloadDurableState = () => {},
  onStorageSignal,
}: {
  locks: DailyAtBatExclusiveLockPort;
  journal: ReturnType<typeof memoryJournal> | {
    read(): JournalRead;
    advanceGeneration(): JournalMutationStatus;
  };
  storageSignals?: DailyAtBatStorageSignalPort | null;
  reloadDurableState?: () => Promise<void> | void;
  onStorageSignal?: (key: string | null) => void;
}) {
  return createDailyAtBatOwnershipCoordinator({
    identity: IDENTITY, journal, lockPort: locks, storageSignals,
    createAbortController: () => new AbortController(), reloadDurableState,
    ...(onStorageSignal === undefined ? {} : { onStorageSignal }),
  });
}

class FakeLocks implements DailyAtBatExclusiveLockPort {
  readonly names: string[] = [];
  private held = false;
  private queue: LockRequest[] = [];

  requestExclusive(name: string, signal: AbortSignal, callback: () => Promise<void>): Promise<void> {
    this.names.push(name);
    return new Promise((resolve, reject) => {
      const request: LockRequest = { callback, resolve, reject, signal, started: false };
      const abort = () => {
        if (request.started) return;
        this.queue = this.queue.filter(candidate => candidate !== request);
        reject(new Error('aborted'));
      };
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      this.queue.push(request);
      queueMicrotask(() => this.pump());
    });
  }

  private pump() {
    if (this.held) return;
    const request = this.queue.shift();
    if (request === undefined) return;
    if (request.signal.aborted) { request.reject(new Error('aborted')); this.pump(); return; }
    request.started = true;
    this.held = true;
    void request.callback().then(request.resolve, request.reject).finally(() => {
      this.held = false;
      queueMicrotask(() => this.pump());
    });
  }
}

type LockRequest = {
  callback: () => Promise<void>;
  resolve: () => void;
  reject: (reason?: unknown) => void;
  signal: AbortSignal;
  started: boolean;
};

class FakeStorageSignals implements DailyAtBatStorageSignalPort {
  private listeners = new Set<(key: string | null) => void>();
  subscribe(listener: (key: string | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  fire(key: string | null) { for (const listener of this.listeners) listener(key); }
}

function memoryJournal(initial: { attemptId: string; generation: number } | null = null) {
  let current = initial;
  return {
    read: (): JournalRead => current === null
      ? { kind: 'missing' }
      : { kind: 'valid', journal: journalRecord(current) },
    advanceGeneration: (): JournalMutationStatus => {
      if (current === null) return 'missing';
      current = { ...current, generation: current.generation + 1 };
      return 'updated';
    },
    current: () => current,
  };
}
function journalRecord(current: { attemptId: string; generation: number }): DailyAtBatAttemptJournal {
  return { version: 1, identity: IDENTITY, attemptId: current.attemptId, contributionState: 'active',
    generation: current.generation, observations: {} };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function tick() { return new Promise<void>(resolve => setTimeout(resolve, 0)); }
