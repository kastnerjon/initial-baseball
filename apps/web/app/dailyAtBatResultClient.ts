'use client';

import type { DailyAtBatResultSubmission, DailyCompletedAtBat } from '@initial-baseball/shared';
import {
  createDailyAtBatAttemptJournalStore,
  type DailyAtBatAttemptIdentity,
  type DailyAtBatDeliveryStatus,
  type JournalMutationStatus,
} from './dailyAtBatAttemptJournal';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type SubmissionRequest = (
  submission: DailyAtBatResultSubmission,
  signal: AbortSignal,
) => Promise<{ ok: boolean; status: number }>;

const DEFAULT_DAILY_AT_BAT_DELIVERY_TIMEOUT_MS = 5_000;

export type DailyAtBatDeliveryState =
  | DailyAtBatDeliveryStatus
  | 'not_started'
  | 'unavailable'
  | 'stale';

export type DailyAtBatOwnerDeliverySession = {
  readonly attemptId: string;
  readonly generation: number;
  deliverObservation(pitchNumber: number): Promise<DailyAtBatDeliveryState>;
  retryPending(options?: {
    excludePitchNumbers?: readonly number[];
  }): Promise<DailyAtBatDeliveryState[]>;
  dispose(): void;
};

export function createBrowserDailyAtBatResultClient(storage: StoragePort | null) {
  return createDailyAtBatResultClient({
    storage,
    createAttemptId: () => {
      try { return globalThis.crypto?.randomUUID?.() ?? null; } catch { return null; }
    },
    submitRequest: async (submission, signal) => {
      const response = await fetch('/api/daily/at-bats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
        signal,
      });
      return { ok: response.ok, status: response.status };
    },
  });
}

export function createDailyAtBatResultClient({
  storage,
  createAttemptId,
  submitRequest,
  requestTimeoutMs = DEFAULT_DAILY_AT_BAT_DELIVERY_TIMEOUT_MS,
}: {
  storage: StoragePort | null;
  createAttemptId: () => string | null;
  submitRequest: SubmissionRequest;
  requestTimeoutMs?: number;
}) {
  const journalStore = createDailyAtBatAttemptJournalStore({ storage, createAttemptId });
  const inFlight = new Map<string, Promise<DailyAtBatDeliveryState>>();

  function createOwnerDeliverySession(
    identity: DailyAtBatAttemptIdentity,
  ): DailyAtBatOwnerDeliverySession | null {
    const initial = journalStore.read(identity);
    if (initial.kind !== 'valid') return null;

    const attemptId = initial.journal.attemptId;
    const generation = initial.journal.generation;
    let disposed = false;

    function readOwnedJournal() {
      if (disposed) return null;
      const current = journalStore.read(identity);
      return current.kind === 'valid'
        && current.journal.attemptId === attemptId
        && current.journal.generation === generation
        ? current.journal
        : null;
    }

    async function deliverObservation(
      pitchNumber: number,
    ): Promise<DailyAtBatDeliveryState> {
      const current = readOwnedJournal();
      if (current === null) return 'stale';

      const observation = current.observations[String(pitchNumber)];
      if (observation === undefined) return 'not_started';
      if (observation.delivery !== 'pending') return observation.delivery;

      const flightKey = [attemptId, generation, pitchNumber].join(':');
      const active = inFlight.get(flightKey);
      if (active !== undefined) return active;

      const request = deliver({
        identity,
        generation,
        submission: cloneSubmission(observation.submission),
        journalStore,
        submitRequest,
        requestTimeoutMs,
        isOwnerCurrent: () => readOwnedJournal() !== null,
      }).finally(() => {
        if (inFlight.get(flightKey) === request) inFlight.delete(flightKey);
      });
      inFlight.set(flightKey, request);
      return request;
    }

    async function retryPending(options: {
      excludePitchNumbers?: readonly number[];
    } = {}): Promise<DailyAtBatDeliveryState[]> {
      const current = readOwnedJournal();
      if (current === null) return [];

      const excluded = new Set(options.excludePitchNumbers ?? []);
      const pitchNumbers = Object.values(current.observations)
        .filter(observation => observation.delivery === 'pending'
          && !excluded.has(observation.submission.atBat.pitchNumber))
        .map(observation => observation.submission.atBat.pitchNumber)
        .sort((a, b) => a - b);

      const results: DailyAtBatDeliveryState[] = [];
      for (const pitchNumber of pitchNumbers) {
        if (disposed) break;
        results.push(await deliverObservation(pitchNumber));
        if (disposed) break;
      }
      return results;
    }

    return {
      attemptId,
      generation,
      deliverObservation,
      retryPending,
      dispose() {
        disposed = true;
      },
    };
  }

  return {
    readAttempt: journalStore.read,
    establishAttempt: journalStore.create,
    advanceGeneration: journalStore.advanceGeneration,
    retireAttempt: journalStore.retire,
    freezeObservation(input: {
      identity: DailyAtBatAttemptIdentity;
      generation: number;
      atBat: DailyCompletedAtBat;
    }): JournalMutationStatus {
      return journalStore.appendObservation(input);
    },
    createOwnerDeliverySession,
  };
}

async function deliver({
  identity,
  generation,
  submission,
  journalStore,
  submitRequest,
  requestTimeoutMs,
  isOwnerCurrent,
}: {
  identity: DailyAtBatAttemptIdentity;
  generation: number;
  submission: DailyAtBatResultSubmission;
  journalStore: ReturnType<typeof createDailyAtBatAttemptJournalStore>;
  submitRequest: SubmissionRequest;
  requestTimeoutMs: number;
  isOwnerCurrent: () => boolean;
}): Promise<DailyAtBatDeliveryState> {
  let response: { ok: boolean; status: number } | null;
  try {
    response = await submitWithDeadline(
      cloneSubmission(submission),
      submitRequest,
      requestTimeoutMs,
    );
  } catch {
    return isOwnerCurrent() ? 'pending' : 'stale';
  }

  if (response === null) return isOwnerCurrent() ? 'pending' : 'stale';

  if (!isOwnerCurrent()) return 'stale';

  const nextStatus = responseStatus(response);
  if (nextStatus === 'pending') return nextStatus;

  const mutation = journalStore.updateDelivery({
    identity,
    generation,
    submission,
    delivery: nextStatus,
  });
  if (mutation === 'updated') return nextStatus;
  if (mutation === 'stale') return 'stale';
  if (mutation !== 'existing') return 'unavailable';

  const current = journalStore.read(identity);
  if (current.kind !== 'valid') return 'unavailable';
  const observation = current.journal.observations[String(submission.atBat.pitchNumber)];
  return observation?.delivery ?? 'stale';
}

async function submitWithDeadline(
  submission: DailyAtBatResultSubmission,
  submitRequest: SubmissionRequest,
  requestTimeoutMs: number,
): Promise<{ ok: boolean; status: number } | null> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const request = submitRequest(submission, controller.signal).then(
    response => ({ kind: 'response' as const, response }),
    error => ({ kind: 'error' as const, error }),
  );
  const timeout = new Promise<{ kind: 'timeout' }>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ kind: 'timeout' });
      controller.abort();
    }, normalizeRequestTimeoutMs(requestTimeoutMs));
  });

  const outcome = await Promise.race([request, timeout]);
  if (timeoutId !== null) clearTimeout(timeoutId);

  if (outcome.kind === 'response') return outcome.response;
  if (outcome.kind === 'error') throw outcome.error;
  return null;
}

function normalizeRequestTimeoutMs(value: number): number {
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_DAILY_AT_BAT_DELIVERY_TIMEOUT_MS;
}

function responseStatus(response: { ok: boolean; status: number }): DailyAtBatDeliveryStatus {
  if (response.ok) return 'submitted';
  if (response.status === 409) return 'conflict';
  if ([408, 425, 429].includes(response.status) || response.status >= 500) return 'pending';
  return response.status >= 400 && response.status < 500 ? 'rejected' : 'pending';
}

function cloneSubmission(submission: DailyAtBatResultSubmission): DailyAtBatResultSubmission {
  return { ...submission, atBat: { ...submission.atBat } };
}
