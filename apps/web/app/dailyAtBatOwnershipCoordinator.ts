'use client';

import type {
  DailyAtBatAttemptIdentity,
  JournalMutationStatus,
  JournalRead,
} from './dailyAtBatAttemptJournal';

const LOCK_PREFIX = 'initial-baseball:daily-at-bat-owner:v1';

type AbortSignalPort = {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
};
type AbortControllerPort = { readonly signal: AbortSignalPort; abort(): void };

export type DailyAtBatExclusiveLockPort = {
  requestExclusive(
    name: string,
    signal: AbortSignalPort,
    callback: () => Promise<void>,
  ): Promise<void>;
};
export type DailyAtBatStorageSignalPort = {
  subscribe(listener: (key: string | null) => void): () => void;
};
export type DailyAtBatGenerationJournalPort = {
  read(identity: DailyAtBatAttemptIdentity): JournalRead;
  advanceGeneration(identity: DailyAtBatAttemptIdentity): JournalMutationStatus;
};

export type DailyAtBatOwnershipState =
  | { status: 'follower' }
  | { status: 'owner'; generation: number | null }
  | { status: 'unsupported'; reason: DailyAtBatOwnershipUnsupportedReason };
export type DailyAtBatOwnershipUnsupportedReason =
  | 'locks_unavailable'
  | 'abort_unavailable'
  | 'journal_unavailable'
  | 'owner_reload_failed'
  | 'lock_request_failed';

type ReloadDurableState = (context: { generation: number | null }) => Promise<void> | void;
type OwnershipListener = (state: DailyAtBatOwnershipState) => void;

export function getDailyAtBatOwnershipLockName(identity: DailyAtBatAttemptIdentity): string {
  return [LOCK_PREFIX, identity.rulesetVersion, identity.puzzleDate, encodeURIComponent(identity.id)].join(':');
}

export function createDailyAtBatOwnershipCoordinator({
  identity,
  journal,
  lockPort,
  storageSignals = null,
  createAbortController,
  reloadDurableState,
  onStorageSignal,
}: {
  identity: DailyAtBatAttemptIdentity;
  journal: DailyAtBatGenerationJournalPort;
  lockPort: DailyAtBatExclusiveLockPort | null;
  storageSignals?: DailyAtBatStorageSignalPort | null;
  createAbortController: (() => AbortControllerPort) | null;
  reloadDurableState: ReloadDurableState;
  onStorageSignal?: (key: string | null) => void;
}) {
  let state: DailyAtBatOwnershipState = { status: 'follower' };
  let started = false;
  let lifecycle = 0;
  let abortController: AbortControllerPort | null = null;
  let releaseOwner: (() => void) | null = null;
  let unsubscribeStorage: (() => void) | null = null;
  const listeners = new Set<OwnershipListener>();

  function setState(next: DailyAtBatOwnershipState) {
    if (sameState(state, next)) return;
    state = next;
    for (const listener of listeners) listener(state);
  }

  function start() {
    if (started) return;
    started = true;
    const run = ++lifecycle;
    setState({ status: 'follower' });

    if (lockPort === null) {
      setState({ status: 'unsupported', reason: 'locks_unavailable' });
      return;
    }
    if (createAbortController === null) {
      setState({ status: 'unsupported', reason: 'abort_unavailable' });
      return;
    }

    abortController = createAbortController();
    unsubscribeStorage = storageSignals?.subscribe((key) => {
      if (started && run === lifecycle) onStorageSignal?.(key);
    }) ?? null;

    void lockPort.requestExclusive(
      getDailyAtBatOwnershipLockName(identity),
      abortController.signal,
      async () => runAsOwner(run),
    ).catch(() => {
      if (started && run === lifecycle && abortController?.signal.aborted !== true) {
        setState({ status: 'unsupported', reason: 'lock_request_failed' });
      }
    });
  }

  async function runAsOwner(run: number) {
    if (!started || run !== lifecycle) return;
    const release = deferred();
    const releaseThisOwner = release.resolve;
    releaseOwner = releaseThisOwner;
    try {
      const claim = claimExistingGeneration(journal, identity);
      if (!claim.ok) {
        if (started && run === lifecycle) {
          setState({ status: 'unsupported', reason: 'journal_unavailable' });
        }
        return;
      }

      const prepared = Promise.resolve()
        .then(() => reloadDurableState({ generation: claim.generation }))
        .then(() => 'ready' as const, () => 'failed' as const);
      const outcome = await Promise.race([
        prepared,
        release.promise.then(() => 'released' as const),
      ]);
      if (outcome === 'failed') {
        if (started && run === lifecycle) {
          setState({ status: 'unsupported', reason: 'owner_reload_failed' });
        }
        return;
      }
      if (outcome !== 'ready' || !started || run !== lifecycle) return;

      setState({ status: 'owner', generation: claim.generation });
      await release.promise;
    } finally {
      if (releaseOwner === releaseThisOwner) releaseOwner = null;
    }
  }

  function stop() {
    if (!started) return;
    started = false;
    lifecycle += 1;
    unsubscribeStorage?.();
    unsubscribeStorage = null;
    abortController?.abort();
    abortController = null;
    releaseOwner?.();
    releaseOwner = null;
    setState({ status: 'follower' });
  }

  return {
    start,
    stop,
    getState: () => state,
    subscribe(listener: OwnershipListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createBrowserDailyAtBatOwnershipCoordinator(input: {
  identity: DailyAtBatAttemptIdentity;
  journal: DailyAtBatGenerationJournalPort;
  reloadDurableState: ReloadDurableState;
  onStorageSignal?: (key: string | null) => void;
}) {
  return createDailyAtBatOwnershipCoordinator({
    ...input,
    lockPort: browserLockPort(),
    storageSignals: browserStorageSignalPort(),
    createAbortController: browserAbortControllerFactory(),
  });
}

function claimExistingGeneration(
  journal: DailyAtBatGenerationJournalPort,
  identity: DailyAtBatAttemptIdentity,
): { ok: true; generation: number | null } | { ok: false } {
  try {
    const before = journal.read(identity);
    if (before.kind === 'missing') return { ok: true, generation: null };
    if (before.kind !== 'valid') return { ok: false };
    if (journal.advanceGeneration(identity) !== 'updated') return { ok: false };
    const after = journal.read(identity);
    if (after.kind !== 'valid'
      || after.journal.attemptId !== before.journal.attemptId
      || after.journal.generation !== before.journal.generation + 1) return { ok: false };
    return { ok: true, generation: after.journal.generation };
  } catch {
    return { ok: false };
  }
}

function browserLockPort(): DailyAtBatExclusiveLockPort | null {
  type BrowserLockManager = { request(
    name: string,
    options: { mode: 'exclusive'; signal: unknown },
    callback: () => Promise<void>,
  ): Promise<unknown> };
  const locks = (globalThis as unknown as { navigator?: { locks?: BrowserLockManager } })
    .navigator?.locks;
  if (typeof locks?.request !== 'function') return null;
  return {
    async requestExclusive(name, signal, callback) {
      await locks.request(name, { mode: 'exclusive', signal }, callback);
    },
  };
}

function browserStorageSignalPort(): DailyAtBatStorageSignalPort | null {
  type StorageTarget = {
    addEventListener(type: 'storage', listener: (event: unknown) => void): void;
    removeEventListener(type: 'storage', listener: (event: unknown) => void): void;
  };
  const target = globalThis as unknown as Partial<StorageTarget>;
  if (typeof target.addEventListener !== 'function'
    || typeof target.removeEventListener !== 'function') return null;
  return {
    subscribe(listener) {
      const handler = (event: unknown) => listener(readStorageKey(event));
      target.addEventListener!('storage', handler);
      return () => target.removeEventListener!('storage', handler);
    },
  };
}

function browserAbortControllerFactory(): (() => AbortControllerPort) | null {
  type AbortControllerConstructor = new () => AbortControllerPort;
  const Constructor = (globalThis as unknown as { AbortController?: AbortControllerConstructor })
    .AbortController;
  return Constructor === undefined ? null : () => new Constructor();
}

function readStorageKey(event: unknown): string | null {
  if (typeof event !== 'object' || event === null || !('key' in event)) return null;
  const key = (event as { key?: unknown }).key;
  return typeof key === 'string' ? key : null;
}
function sameState(a: DailyAtBatOwnershipState, b: DailyAtBatOwnershipState): boolean {
  if (a.status !== b.status) return false;
  if (a.status === 'owner' && b.status === 'owner') return a.generation === b.generation;
  if (a.status === 'unsupported' && b.status === 'unsupported') return a.reason === b.reason;
  return true;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
