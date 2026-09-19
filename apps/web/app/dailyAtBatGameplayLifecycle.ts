'use client';

import { POINTS_V3_DAILY_RULESET_VERSION, type DailyCompletedAtBat } from '@initial-baseball/shared';
import { canCreateCompletedResultFromLoadedSave } from './dailyCompletedResultActivation';
import {
  createDailyAtBatAttemptJournalStore,
  type DailyAtBatAttemptIdentity,
  type DailyAtBatAttemptJournal,
} from './dailyAtBatAttemptJournal';
import type { LoadedSavedDailyGame } from './dailyLocalStorage';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type JournalStore = ReturnType<typeof createDailyAtBatAttemptJournalStore>;

export type DailyAtBatContributionInactiveReason =
  | 'legacy_save'
  | 'unusable_save'
  | 'attempt_unavailable'
  | 'retired'
  | 'durable_mismatch'
  | 'journal_unavailable'
  | 'save_failure'
  | 'delivery_failure';

export type DailyAtBatContributionSession =
  | {
      status: 'active';
      attemptId: string;
      generation: number;
      allowCompletedResultCreate: boolean;
    }
  | {
      status: 'inactive';
      reason: DailyAtBatContributionInactiveReason;
      allowCompletedResultCreate: boolean;
    };

export function createDailyAtBatGameplayLifecycle({
  identity,
  storage,
  createAttemptId,
}: {
  identity: DailyAtBatAttemptIdentity;
  storage: StoragePort | null;
  createAttemptId: () => string | null;
}) {
  const journal = createDailyAtBatAttemptJournalStore({ storage, createAttemptId });

  return {
    journal,

    prepareOwnerWithoutContribution(input: {
      loaded: LoadedSavedDailyGame | null;
      totalAtBats: number;
    }): DailyAtBatContributionSession {
      return inactive(
        'journal_unavailable',
        input.loaded === null || canCreateCompletedResult(input.loaded, input.totalAtBats),
      );
    },

    prepareOwner(input: {
      loaded: LoadedSavedDailyGame | null;
      hadPersistedGameplayValue: boolean;
      claimedGeneration: number | null;
      totalAtBats: number;
    }): DailyAtBatContributionSession {
      const current = journal.read(identity);

      if (input.claimedGeneration === null) {
        if (input.loaded === null && input.hadPersistedGameplayValue) {
          return inactive('unusable_save', true);
        }
        if (input.loaded !== null) {
          return current.kind === 'missing'
            ? inactive(
                'legacy_save',
                canCreateCompletedResult(input.loaded, input.totalAtBats),
              )
            : inactive('journal_unavailable', false);
        }

        if (current.kind !== 'missing') {
          return inactive('journal_unavailable', false);
        }

        if (journal.create(identity) !== 'created') {
          return inactive('attempt_unavailable', true);
        }
        const created = journal.read(identity);
        return created.kind === 'valid'
          && created.journal.contributionState === 'active'
          && Object.keys(created.journal.observations).length === 0
          ? active(created.journal, true)
          : inactive('journal_unavailable', false);
      }

      if (current.kind !== 'valid'
        || current.journal.generation !== input.claimedGeneration) {
        return inactive('journal_unavailable', false);
      }
      return reconcileExistingJournal(
        journal,
        identity,
        current.journal,
        input.loaded,
        input.hadPersistedGameplayValue,
        input.totalAtBats,
      );
    },

    resetContribution(
      session: DailyAtBatContributionSession,
    ): DailyAtBatContributionSession {
      if (session.status === 'inactive') {
        const mayReplayCompletion = session.reason === 'legacy_save'
          || session.reason === 'unusable_save'
          || session.reason === 'attempt_unavailable';
        return { ...session, allowCompletedResultCreate: mayReplayCompletion };
      }

      const current = journal.read(identity);
      if (current.kind !== 'valid'
        || current.journal.attemptId !== session.attemptId
        || current.journal.generation !== session.generation) {
        return inactive('journal_unavailable', false);
      }
      if (current.journal.contributionState === 'retired') {
        return inactive('retired', false);
      }
      if (Object.keys(current.journal.observations).length === 0) {
        return { ...session, allowCompletedResultCreate: true };
      }
      return retire(journal, identity, session.generation, 'retired');
    },

    retireAfterGameplaySaveFailure(
      session: DailyAtBatContributionSession,
    ): DailyAtBatContributionSession {
      if (session.status !== 'active') return session;
      journal.retire(identity, session.generation);
      return inactive('save_failure', false);
    },

    retireAfterDeliveryFailure(
      session: DailyAtBatContributionSession,
    ): DailyAtBatContributionSession {
      if (session.status !== 'active') return session;
      journal.retire(identity, session.generation);
      return inactive('delivery_failure', false);
    },
  };
}

export function createBrowserDailyAtBatGameplayLifecycle(
  identity: DailyAtBatAttemptIdentity,
  storage: StoragePort | null,
) {
  return createDailyAtBatGameplayLifecycle({
    identity,
    storage,
    createAttemptId: () => {
      try { return globalThis.crypto?.randomUUID?.() ?? null; } catch { return null; }
    },
  });
}

function reconcileExistingJournal(
  journal: JournalStore,
  identity: DailyAtBatAttemptIdentity,
  current: DailyAtBatAttemptJournal,
  loaded: LoadedSavedDailyGame | null,
  hadPersistedGameplayValue: boolean,
  totalAtBats: number,
): DailyAtBatContributionSession {
  if (current.contributionState === 'retired') {
    return inactive('retired', false);
  }

  if (loaded === null) {
    if (hadPersistedGameplayValue) {
      return retire(journal, identity, current.generation, 'durable_mismatch');
    }
    return Object.keys(current.observations).length === 0
      ? active(current, true)
      : retire(journal, identity, current.generation, 'durable_mismatch');
  }

  if (loaded.savedGame.gameState.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    || !loaded.completedAtBatFactsAreNative) {
    return retire(journal, identity, current.generation, 'durable_mismatch');
  }

  const persistedFacts = loaded.savedGame.pendingAdvance?.completedAtBats
    ?? loaded.savedGame.gameState.completedAtBats;
  const observedFacts = Object.values(current.observations)
    .map(observation => observation.submission.atBat)
    .sort((a, b) => a.pitchNumber - b.pitchNumber);

  if (!sameAtBats(observedFacts, persistedFacts)) {
    return retire(journal, identity, current.generation, 'durable_mismatch');
  }

  return active(current, canCreateCompletedResult(loaded, totalAtBats));
}

function retire(
  journal: JournalStore,
  identity: DailyAtBatAttemptIdentity,
  generation: number,
  reason: Extract<DailyAtBatContributionInactiveReason, 'retired' | 'durable_mismatch'>,
): DailyAtBatContributionSession {
  const result = journal.retire(identity, generation);
  return result === 'updated' || result === 'existing'
    ? inactive(reason, false)
    : inactive('journal_unavailable', false);
}

function active(
  journal: DailyAtBatAttemptJournal,
  allowCompletedResultCreate: boolean,
): DailyAtBatContributionSession {
  return {
    status: 'active',
    attemptId: journal.attemptId,
    generation: journal.generation,
    allowCompletedResultCreate,
  };
}

function inactive(
  reason: DailyAtBatContributionInactiveReason,
  allowCompletedResultCreate: boolean,
): DailyAtBatContributionSession {
  return { status: 'inactive', reason, allowCompletedResultCreate };
}

function canCreateCompletedResult(
  loaded: LoadedSavedDailyGame,
  totalAtBats: number,
): boolean {
  return canCreateCompletedResultFromLoadedSave({
    savedGame: loaded.savedGame,
    totalAtBats,
    completedAtBatFactsAreNative: loaded.completedAtBatFactsAreNative,
  });
}

function sameAtBats(a: DailyCompletedAtBat[], b: DailyCompletedAtBat[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => {
    const other = b[index];
    return other !== undefined
      && value.pitchNumber === other.pitchNumber
      && value.initials === other.initials
      && value.outcome === other.outcome
      && value.hintsRevealed === other.hintsRevealed
      && value.wrongGuesses === other.wrongGuesses
      && value.resolution === other.resolution;
  });
}
