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
) => Promise<{ ok: boolean; status: number }>;

export type DailyAtBatDeliveryState =
  | DailyAtBatDeliveryStatus
  | 'not_started'
  | 'unavailable'
  | 'stale';

export type DailyAtBatOwnerDeliverySession = {
  readonly attemptId: string;
  readonly generation: number;
  deliverObservation(pitchNumber: number): Promise<DailyAtBatDeliveryState>;
  retryPending(): Promise<DailyAtBatDeliveryState[]>;
  dispose(): void;
};

export function createBrowserDailyAtBatResultClient(storage: StoragePort | null) {
  return createDailyAtBatResultClient({
    storage,
    createAttemptId: () => {
      try { return globalThis.crypto?.randomUUID?.() ?? null; } catch { return null; }
    },
    submitRequest: async (submission) => {
      const response = await fetch('/api/daily/at-bats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });
      return { ok: response.ok, status: response.status };
    },
  });
}

export function createDailyAtBatResultClient({
  storage,
  createAttemptId,
  submitRequest,
}: {
  storage: StoragePort | null;
  createAttemptId: () => string | null;
  submitRequest: SubmissionRequest;
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
        isOwnerCurrent: () => readOwnedJournal() !== null,
      }).finally(() => {
        if (inFlight.get(flightKey) === request) inFlight.delete(flightKey);
      });
      inFlight.set(flightKey, request);
      return request;
    }

    async function retryPending(): Promise<DailyAtBatDeliveryState[]> {
      const current = readOwnedJournal();
      if (current === null) return [];

      const pitchNumbers = Object.values(current.observations)
        .filter(observation => observation.delivery === 'pending')
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
  isOwnerCurrent,
}: {
  identity: DailyAtBatAttemptIdentity;
  generation: number;
  submission: DailyAtBatResultSubmission;
  journalStore: ReturnType<typeof createDailyAtBatAttemptJournalStore>;
  submitRequest: SubmissionRequest;
  isOwnerCurrent: () => boolean;
}): Promise<DailyAtBatDeliveryState> {
  let response: { ok: boolean; status: number };
  try {
    response = await submitRequest(cloneSubmission(submission));
  } catch {
    return isOwnerCurrent() ? 'pending' : 'stale';
  }

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

function responseStatus(response: { ok: boolean; status: number }): DailyAtBatDeliveryStatus {
  if (response.ok) return 'submitted';
  if (response.status === 409) return 'conflict';
  if ([408, 425, 429].includes(response.status) || response.status >= 500) return 'pending';
  return response.status >= 400 && response.status < 500 ? 'rejected' : 'pending';
}

function cloneSubmission(submission: DailyAtBatResultSubmission): DailyAtBatResultSubmission {
  return { ...submission, atBat: { ...submission.atBat } };
}
