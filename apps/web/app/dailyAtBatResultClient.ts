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

  async function deliverObservation(
    identity: DailyAtBatAttemptIdentity,
    pitchNumber: number,
  ): Promise<DailyAtBatDeliveryState> {
    const current = journalStore.read(identity);
    if (current.kind === 'missing') return 'not_started';
    if (current.kind !== 'valid') return 'unavailable';

    const observation = current.journal.observations[String(pitchNumber)];
    if (observation === undefined) return 'not_started';
    if (observation.delivery !== 'pending') return observation.delivery;

    const flightKey = [current.journal.attemptId, current.journal.generation, pitchNumber].join(':');
    const active = inFlight.get(flightKey);
    if (active !== undefined) return active;

    const request = deliver({
      identity,
      generation: current.journal.generation,
      submission: cloneSubmission(observation.submission),
      journalStore,
      submitRequest,
    }).finally(() => {
      if (inFlight.get(flightKey) === request) inFlight.delete(flightKey);
    });
    inFlight.set(flightKey, request);
    return request;
  }

  async function retryPending(
    identity: DailyAtBatAttemptIdentity,
  ): Promise<DailyAtBatDeliveryState[]> {
    const current = journalStore.read(identity);
    if (current.kind !== 'valid') return [];

    const pitchNumbers = Object.values(current.journal.observations)
      .filter(observation => observation.delivery === 'pending')
      .map(observation => observation.submission.atBat.pitchNumber)
      .sort((a, b) => a - b);

    const results: DailyAtBatDeliveryState[] = [];
    for (const pitchNumber of pitchNumbers) {
      results.push(await deliverObservation(identity, pitchNumber));
    }
    return results;
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
    deliverObservation,
    retryPending,
  };
}

async function deliver({
  identity,
  generation,
  submission,
  journalStore,
  submitRequest,
}: {
  identity: DailyAtBatAttemptIdentity;
  generation: number;
  submission: DailyAtBatResultSubmission;
  journalStore: ReturnType<typeof createDailyAtBatAttemptJournalStore>;
  submitRequest: SubmissionRequest;
}): Promise<DailyAtBatDeliveryState> {
  let response: { ok: boolean; status: number };
  try {
    response = await submitRequest(cloneSubmission(submission));
  } catch {
    return 'pending';
  }

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
