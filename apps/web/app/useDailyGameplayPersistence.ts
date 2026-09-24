'use client';

import { useEffect, useRef, useState } from 'react';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyPublicPuzzle,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { canCreateCompletedResultFromLoadedSave } from './dailyCompletedResultActivation';
import {
  createBrowserDailyAtBatGameplayLifecycle,
  type DailyAtBatContributionSession,
} from './dailyAtBatGameplayLifecycle';
import { persistGameplayThenFreezeDailyAtBats } from './dailyAtBatGameplayCommit';
import {
  createBrowserDailyAtBatResultClient,
  type DailyAtBatDeliveryState,
} from './dailyAtBatResultClient';
import { createBrowserDailyAtBatOwnershipCoordinator } from './dailyAtBatOwnershipCoordinator';
import {
  clearSavedDailyGame,
  hasPersistedDailyGameValue,
  loadSavedDailyGameWithProvenance,
  saveDailyGame,
  type LoadedSavedDailyGame,
  type SaveDailyGameInput,
} from './dailyLocalStorage';
import { getDailyModeStorage, isDailyModeSaveCompatible } from './dailyModeStorage';
import {
  createDailyGameplayPersistenceSession,
} from './dailyGameplayPersistenceSession';
import {
  getDailyGameplayPersistenceSessionKey,
  type DailyGameplayAccess,
} from './dailyGameplayPersistenceAuthority';

export function useDailyGameplayPersistence({
  puzzle,
  rulesetVersion,
  initialProgressionToken,
  hasLoadedSavedState,
  saveInput,
  onRestore,
  onPersistenceSessionInvalidated,
  submitCompletedResultCreationIfEligible,
}: {
  puzzle: DailyPublicPuzzle;
  rulesetVersion: DailyRulesetVersion;
  initialProgressionToken: string;
  hasLoadedSavedState: boolean;
  saveInput: SaveDailyGameInput;
  onRestore: (loaded: LoadedSavedDailyGame | null) => void;
  onPersistenceSessionInvalidated: () => void;
  submitCompletedResultCreationIfEligible: (input: {
    allowCreate: boolean;
    creationSubmissionId?: string | null;
  }) => void;
}) {
  const sessionKey = getDailyGameplayPersistenceSessionKey(puzzle, rulesetVersion);
  const [access, setAccess] = useState<DailyGameplayAccess>('checking');
  const [readySessionKey, setReadySessionKey] = useState<string | null>(null);
  const [contribution, setContribution] = useState<DailyAtBatContributionSession | null>(null);
  const restoreRef = useRef(onRestore);
  const persistenceSessionInvalidatedRef = useRef(onPersistenceSessionInvalidated);
  const completedResultRef = useRef(submitCompletedResultCreationIfEligible);
  const [persistenceSession] = useState(() => createDailyGameplayPersistenceSession({
    onAccessChange: setAccess,
    onContributionChange: setContribution,
    onReadySessionKeyChange: setReadySessionKey,
    onPersistenceSessionInvalidated: () => persistenceSessionInvalidatedRef.current(),
  }));
  restoreRef.current = onRestore;
  persistenceSessionInvalidatedRef.current = onPersistenceSessionInvalidated;
  completedResultRef.current = submitCompletedResultCreationIfEligible;

  useEffect(() => {
    let cancelled = false;
    const ownedSessionKey = sessionKey;
    persistenceSession.beginSession(ownedSessionKey);
    const storage = getDailyModeStorage(rulesetVersion, undefined, puzzle.id);
    const initialLoaded = loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage);
    const coordinate = rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
      && (initialLoaded === null
        || initialLoaded.savedGame.gameState.rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION);

    if (!coordinate) {
      restoreCompatibility(initialLoaded);
      persistenceSession.markReady(ownedSessionKey);
      persistenceSession.setAccess('compatibility');
      return () => {
        cancelled = true;
        persistenceSession.releaseSession(ownedSessionKey);
      };
    }

    const identity = {
      id: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    } as const;
    const lifecycle = createBrowserDailyAtBatGameplayLifecycle(identity, storage);
    const resultClient = createBrowserDailyAtBatResultClient(storage);
    persistenceSession.configureOwnerRuntime({ identity, lifecycle, resultClient });

    const coordinator = createBrowserDailyAtBatOwnershipCoordinator({
      identity,
      journal: lifecycle.journal,
      reloadDurableState: ({ generation, contribution: ownerContribution }) => {
        const loaded = loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage);
        const next = ownerContribution === 'enabled'
          ? lifecycle.prepareOwner({
              loaded,
              hadPersistedGameplayValue: hasPersistedDailyGameValue(puzzle.puzzleDate, storage),
              claimedGeneration: generation,
              totalAtBats: puzzle.pitches.length,
            })
          : lifecycle.prepareOwnerWithoutContribution({
              loaded,
              totalAtBats: puzzle.pitches.length,
            });
        if (cancelled || !persistenceSession.isActiveSession(ownedSessionKey)) return;
        persistenceSession.setContribution(next);
        restoreRef.current(loaded);
        persistenceSession.markReady(ownedSessionKey);
      },
    });
    const unsubscribe = coordinator.subscribe((state) => {
      if (cancelled) return;
      if (state.status === 'owner') {
        const ownerDelivery = state.contribution === 'enabled'
          ? resultClient.createOwnerDeliverySession(identity)
          : null;
        persistenceSession.replaceDeliverySession(ownerDelivery);
        persistenceSession.setAccess('owner');
        const expected = persistenceSession.getContribution();
        if (state.contribution === 'enabled' && ownerDelivery === null) {
          if (expected?.status === 'active') persistenceSession.failCurrentContribution(expected);
          return;
        }
        if (ownerDelivery !== null) {
          void ownerDelivery.retryPending().then((results) => {
            if (!cancelled && results.some(isContributionDeliveryFailure)) {
              persistenceSession.failCurrentContribution(expected);
            }
          });
        }
      } else if (state.status === 'follower') {
        persistenceSession.replaceDeliverySession(null);
        persistenceSession.markNotReady(ownedSessionKey);
        persistenceSession.setAccess('follower');
        persistenceSession.setCompletionPolicy(false);
      } else if (state.status === 'blocked') {
        persistenceSession.replaceDeliverySession(null);
        persistenceSession.markNotReady(ownedSessionKey);
        persistenceSession.setAccess('blocked');
        persistenceSession.clearContribution();
        persistenceSession.setCompletionPolicy(false);
      } else {
        persistenceSession.replaceDeliverySession(null);
        persistenceSession.clearContribution();
        restoreCompatibility(loadCompatible(
          puzzle,
          rulesetVersion,
          initialProgressionToken,
          storage,
        ));
        persistenceSession.markReady(ownedSessionKey);
        persistenceSession.setAccess('compatibility');
      }
    });
    persistenceSession.setAccess('follower');
    coordinator.start();

    return () => {
      cancelled = true;
      persistenceSession.releaseSession(ownedSessionKey);
      unsubscribe();
      coordinator.stop();
    };

    function restoreCompatibility(loaded: LoadedSavedDailyGame | null) {
      const allow = compatibilityCompletedResultEligibility(loaded, puzzle.pitches.length);
      persistenceSession.setCompletionPolicy(allow);
      restoreRef.current(loaded);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!hasLoadedSavedState || !persistenceSession.canPersist({
      renderAccess: access,
      renderSessionKey: sessionKey,
      renderReadySessionKey: readySessionKey,
    })) return;

    const storage = getDailyModeStorage(rulesetVersion, undefined, puzzle.id);
    if (access === 'compatibility') {
      if (saveDailyGame(puzzle, saveInput, storage)) {
        completedResultRef.current(persistenceSession.getCompletionPolicy());
      }
      return;
    }

    const current = persistenceSession.getContribution();
    const runtime = persistenceSession.getCommitRuntime();
    if (runtime === null) return;

    const commit = persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => saveDailyGame(puzzle, saveInput, storage),
      contribution: current,
      identity: runtime.identity,
      saveInput,
      freezeObservation: input => runtime.resultClient.freezeObservation(input),
    });

    if (!commit.saved) {
      persistenceSession.failCurrentGameplaySave(current);
      return;
    }
    if (commit.freezeFailure !== null) {
      persistenceSession.failCurrentContribution(current);
      return;
    }

    const deliveryForCommit = commit.deliveryPitchNumbers.length === 0
      ? null
      : persistenceSession.getMatchingDeliverySession(current);
    if (commit.deliveryPitchNumbers.length > 0 && deliveryForCommit === null) {
      persistenceSession.failCurrentContribution(current);
      return;
    }

    completedResultRef.current(persistenceSession.getCompletionPolicy());

    if (deliveryForCommit === null) return;
    const expected = current;
    for (const pitchNumber of commit.deliveryPitchNumbers) {
      void deliveryForCommit.deliverObservation(pitchNumber).then((result) => {
        if (isContributionDeliveryFailure(result)) {
          persistenceSession.failCurrentContribution(expected);
        }
      });
    }
    void deliveryForCommit.retryPending({
      excludePitchNumbers: commit.deliveryPitchNumbers,
    }).then((results) => {
      if (results.some(isContributionDeliveryFailure)) {
        persistenceSession.failCurrentContribution(expected);
      }
    });
  }, [
    access,
    hasLoadedSavedState,
    persistenceSession,
    readySessionKey,
    rulesetVersion,
    sessionKey,
    saveInput.atBatState,
    saveInput.currentPitchIndex,
    saveInput.gameState,
    saveInput.pendingAdvance,
    saveInput.progressionToken,
    saveInput.scorecardAnswers,
  ]);

  function resetPersistedState(): boolean {
    if (!persistenceSession.canPersist({
      renderAccess: access,
      renderSessionKey: sessionKey,
      renderReadySessionKey: readySessionKey,
    })) return false;

    persistenceSession.resetContributionForCurrentAccess();
    clearSavedDailyGame(puzzle, getDailyModeStorage(rulesetVersion, undefined, puzzle.id));
    return true;
  }

  const currentSession = persistenceSession.isActiveSession(sessionKey);
  return {
    access: currentSession ? access : 'checking',
    contribution: currentSession ? contribution : null,
    resetPersistedState,
  };
}

function isContributionDeliveryFailure(state: DailyAtBatDeliveryState): boolean {
  return state === 'conflict'
    || state === 'rejected'
    || state === 'stale'
    || state === 'unavailable'
    || state === 'not_started';
}

function loadCompatible(
  puzzle: DailyPublicPuzzle,
  rulesetVersion: DailyRulesetVersion,
  initialProgressionToken: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): LoadedSavedDailyGame | null {
  const loaded = loadSavedDailyGameWithProvenance(puzzle, initialProgressionToken, storage);
  return loaded !== null
    && isDailyModeSaveCompatible(rulesetVersion, loaded.savedGame.gameState.rulesetVersion, puzzle.id)
    ? loaded
    : null;
}

function compatibilityCompletedResultEligibility(
  loaded: LoadedSavedDailyGame | null,
  totalAtBats: number,
): boolean {
  return loaded === null || canCreateCompletedResultFromLoadedSave({
    savedGame: loaded.savedGame,
    totalAtBats,
    completedAtBatFactsAreNative: loaded.completedAtBatFactsAreNative,
  });
}
