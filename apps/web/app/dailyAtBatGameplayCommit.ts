'use client';

import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type {
  DailyAtBatAttemptIdentity,
  JournalMutationStatus,
} from './dailyAtBatAttemptJournal';
import type { DailyAtBatContributionSession } from './dailyAtBatGameplayLifecycle';
import type { SaveDailyGameInput } from './dailyLocalStorage';

type FreezeObservation = (input: {
  identity: DailyAtBatAttemptIdentity;
  generation: number;
  atBat: DailyCompletedAtBat;
}) => JournalMutationStatus;

export type DailyGameplayCommitResult = {
  saved: boolean;
  deliveryPitchNumbers: number[];
  freezeFailure: JournalMutationStatus | null;
};

export function persistGameplayThenFreezeDailyAtBats({
  persistGameplay,
  contribution,
  identity,
  saveInput,
  freezeObservation,
}: {
  persistGameplay: () => boolean;
  contribution: DailyAtBatContributionSession | null;
  identity: DailyAtBatAttemptIdentity;
  saveInput: SaveDailyGameInput;
  freezeObservation: FreezeObservation;
}): DailyGameplayCommitResult {
  if (!persistGameplay()) {
    return { saved: false, deliveryPitchNumbers: [], freezeFailure: null };
  }
  if (contribution?.status !== 'active') {
    return { saved: true, deliveryPitchNumbers: [], freezeFailure: null };
  }

  const persistedFacts = saveInput.pendingAdvance?.completedAtBats
    ?? saveInput.gameState.completedAtBats;
  const deliveryPitchNumbers: number[] = [];

  for (const atBat of persistedFacts) {
    const status = freezeObservation({
      identity,
      generation: contribution.generation,
      atBat,
    });
    if (status === 'created') {
      deliveryPitchNumbers.push(atBat.pitchNumber);
      continue;
    }
    if (status === 'existing') continue;
    return { saved: true, deliveryPitchNumbers, freezeFailure: status };
  }

  return { saved: true, deliveryPitchNumbers, freezeFailure: null };
}
