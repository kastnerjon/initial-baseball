'use client';

import { useEffect, useRef, useState } from 'react';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyPublicPuzzle,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { canCreateCompletedResultFromLoadedSave } from './dailyCompletedResultActivation';
import type { DailyAtBatAttemptIdentity } from './dailyAtBatAttemptJournal';
import {
  createBrowserDailyAtBatGameplayLifecycle,
  type DailyAtBatContributionSession,
} from './dailyAtBatGameplayLifecycle';
import { persistGameplayThenFreezeDailyAtBats } from './dailyAtBatGameplayCommit';
import {
  createBrowserDailyAtBatResultClient,
  type DailyAtBatDeliveryState,
  type DailyAtBatOwnerDeliverySession,
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
  canPersistCurrentDailyGameplay,
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
  const accessRef = useRef<DailyGameplayAccess>('checking');
  const activeSessionKeyRef = useRef<string | null>(null);
  const readySessionKeyRef = useRef<string | null>(null);
  const contributionRef = useRef(contribution);
  const identityRef = useRef<DailyAtBatAttemptIdentity | null>(null);
  const lifecycleRef = useRef<ReturnType<typeof createBrowserDailyAtBatGameplayLifecycle> | null>(null);
  const resultClientRef = useRef<ReturnType<typeof createBrowserDailyAtBatResultClient> | null>(null);
  const deliverySessionRef = useRef<DailyAtBatOwnerDeliverySession | null>(null);
  const restoreRef = useRef(onRestore);
  const persistenceSessionInvalidatedRef = useRef(onPersistenceSessionInvalidated);
  const completedResultRef = useRef(submitCompletedResultCreationIfEligible);
  const completionPolicyRef = useRef({
    allowCreate: false,
    creationSubmissionId: null as string | null,
  });
  contributionRef.current = contribution;
  restoreRef.current = onRestore;
  persistenceSessionInvalidatedRef.current = onPersistenceSessionInvalidated;
  completedResultRef.current = submitCompletedResultCreationIfEligible;

  useEffect(() => {
    let cancelled = false;
    const ownedSessionKey = sessionKey;
    activeSessionKeyRef.current = ownedSessionKey;
    markSessionNotReady(ownedSessionKey);
    const storage = getDailyModeStorage(rulesetVersion);
    const initialLoaded = loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage);
    const coordinate = rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
      && (initialLoaded === null
        || initialLoaded.savedGame.gameState.rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION);

    replaceDeliverySession(null);
    identityRef.current = null;
    lifecycleRef.current = null;
    resultClientRef.current = null;
    setContribution(null);
    contributionRef.current = null;
    completionPolicyRef.current = { allowCreate: false, creationSubmissionId: null };

    if (!coordinate) {
      restoreCompatibility(initialLoaded);
      markSessionReady(ownedSessionKey);
      applyAccess('compatibility');
      return () => {
        cancelled = true;
        releasePersistenceSession(ownedSessionKey);
      };
    }

    const identity: DailyAtBatAttemptIdentity = {
      id: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    };
    const lifecycle = createBrowserDailyAtBatGameplayLifecycle(identity, storage);
    const resultClient = createBrowserDailyAtBatResultClient(storage);
    identityRef.current = identity;
    lifecycleRef.current = lifecycle;
    resultClientRef.current = resultClient;

    const coordinator = createBrowserDailyAtBatOwnershipCoordinator({
      identity,
      journal: lifecycle.journal,
      reloadDurableState: ({ generation, contribution }) => {
        const loaded = loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage);
        const next = contribution === 'enabled'
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
        if (cancelled || activeSessionKeyRef.current !== ownedSessionKey) return;
        applyContribution(next);
        restoreRef.current(loaded);
        markSessionReady(ownedSessionKey);
      },
    });
    const unsubscribe = coordinator.subscribe((state) => {
      if (cancelled) return;
      if (state.status === 'owner') {
        const ownerDelivery = state.contribution === 'enabled'
          ? resultClient.createOwnerDeliverySession(identity)
          : null;
        replaceDeliverySession(ownerDelivery);
        applyAccess('owner');
        const expected = contributionRef.current;
        if (state.contribution === 'enabled' && ownerDelivery === null) {
          if (expected?.status === 'active') failCurrentContribution(expected);
          return;
        }
        if (ownerDelivery !== null) {
          void ownerDelivery.retryPending().then((results) => {
            if (!cancelled && results.some(isContributionDeliveryFailure)) {
              failCurrentContribution(expected);
            }
          });
        }
      } else if (state.status === 'follower') {
        replaceDeliverySession(null);
        markSessionNotReady(ownedSessionKey);
        applyAccess('follower');
        completionPolicyRef.current = { allowCreate: false, creationSubmissionId: null };
      } else if (state.status === 'blocked') {
        replaceDeliverySession(null);
        markSessionNotReady(ownedSessionKey);
        applyAccess('blocked');
        setContribution(null);
        contributionRef.current = null;
        completionPolicyRef.current = { allowCreate: false, creationSubmissionId: null };
      } else {
        replaceDeliverySession(null);
        setContribution(null);
        contributionRef.current = null;
        restoreCompatibility(loadCompatible(
          puzzle,
          rulesetVersion,
          initialProgressionToken,
          storage,
        ));
        markSessionReady(ownedSessionKey);
        applyAccess('compatibility');
      }
    });
    applyAccess('follower');
    coordinator.start();

    return () => {
      cancelled = true;
      releasePersistenceSession(ownedSessionKey);
      replaceDeliverySession(null);
      unsubscribe();
      coordinator.stop();
      identityRef.current = null;
      lifecycleRef.current = null;
      resultClientRef.current = null;
    };

    function restoreCompatibility(loaded: LoadedSavedDailyGame | null) {
      const allow = compatibilityCompletedResultEligibility(loaded, puzzle.pitches.length);
      completionPolicyRef.current = { allowCreate: allow, creationSubmissionId: null };
      restoreRef.current(loaded);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!hasLoadedSavedState || !canPersistCurrentDailyGameplay({
      renderAccess: access,
      currentAccess: accessRef.current,
      renderSessionKey: sessionKey,
      currentSessionKey: activeSessionKeyRef.current,
      renderReadySessionKey: readySessionKey,
      currentReadySessionKey: readySessionKeyRef.current,
    })) return;

    const storage = getDailyModeStorage(rulesetVersion);
    if (access === 'compatibility') {
      if (saveDailyGame(puzzle, saveInput, storage)) {
        completedResultRef.current(completionPolicyRef.current);
      }
      return;
    }

    const current = contributionRef.current;
    const identity = identityRef.current;
    const resultClient = resultClientRef.current;
    const ownerDelivery = deliverySessionRef.current;
    if (identity === null || resultClient === null) return;

    const commit = persistGameplayThenFreezeDailyAtBats({
      persistGameplay: () => saveDailyGame(puzzle, saveInput, storage),
      contribution: current,
      identity,
      saveInput,
      freezeObservation: input => resultClient.freezeObservation(input),
    });

    if (!commit.saved) {
      failCurrentGameplaySave(current);
      return;
    }
    if (commit.freezeFailure !== null) {
      failCurrentContribution(current);
      return;
    }

    const deliveryForCommit = commit.deliveryPitchNumbers.length === 0
      ? null
      : sameOwnerDeliverySession(ownerDelivery, current)
        ? ownerDelivery
        : null;
    if (commit.deliveryPitchNumbers.length > 0 && deliveryForCommit === null) {
      failCurrentContribution(current);
      return;
    }

    completedResultRef.current(completionPolicyRef.current);

    if (deliveryForCommit === null) return;
    const expected = current;
    for (const pitchNumber of commit.deliveryPitchNumbers) {
      void deliveryForCommit.deliverObservation(pitchNumber).then((result) => {
        if (isContributionDeliveryFailure(result)) {
          failCurrentContribution(expected);
        }
      });
    }
    void deliveryForCommit.retryPending({
      excludePitchNumbers: commit.deliveryPitchNumbers,
    }).then((results) => {
      if (results.some(isContributionDeliveryFailure)) {
        failCurrentContribution(expected);
      }
    });
  }, [
    access,
    hasLoadedSavedState,
    readySessionKey,
    sessionKey,
    saveInput.atBatState,
    saveInput.currentPitchIndex,
    saveInput.gameState,
    saveInput.pendingAdvance,
    saveInput.progressionToken,
    saveInput.scorecardAnswers,
  ]);

  function replaceDeliverySession(next: DailyAtBatOwnerDeliverySession | null) {
    deliverySessionRef.current?.dispose();
    deliverySessionRef.current = next;
  }

  function markSessionReady(expectedSessionKey: string) {
    if (activeSessionKeyRef.current !== expectedSessionKey) return;
    readySessionKeyRef.current = expectedSessionKey;
    setReadySessionKey(expectedSessionKey);
  }

  function markSessionNotReady(expectedSessionKey: string) {
    if (activeSessionKeyRef.current !== expectedSessionKey) return;
    readySessionKeyRef.current = null;
    setReadySessionKey(null);
  }

  function releasePersistenceSession(expectedSessionKey: string) {
    if (activeSessionKeyRef.current !== expectedSessionKey) return;
    activeSessionKeyRef.current = null;
    readySessionKeyRef.current = null;
    accessRef.current = 'checking';
    persistenceSessionInvalidatedRef.current();
  }

  function applyAccess(next: DailyGameplayAccess) {
    if (accessRef.current === 'owner' && next !== 'owner') {
      persistenceSessionInvalidatedRef.current();
    }
    accessRef.current = next;
    setAccess(next);
  }

  function applyContribution(next: DailyAtBatContributionSession) {
    contributionRef.current = next;
    setContribution(next);
    completionPolicyRef.current = {
      allowCreate: next.allowCompletedResultCreate,
      creationSubmissionId: next.status === 'active' ? next.attemptId : null,
    };
  }

  function failCurrentGameplaySave(expected: DailyAtBatContributionSession | null) {
    const lifecycle = lifecycleRef.current;
    const current = contributionRef.current;
    if (!sameActiveContribution(current, expected) || lifecycle === null) return;
    applyContribution(lifecycle.retireAfterGameplaySaveFailure(current));
  }

  function failCurrentContribution(expected: DailyAtBatContributionSession | null) {
    if (accessRef.current !== 'owner') return;
    const lifecycle = lifecycleRef.current;
    const current = contributionRef.current;
    if (!sameActiveContribution(current, expected) || lifecycle === null) return;
    applyContribution(lifecycle.retireAfterDeliveryFailure(current));
  }

  function resetPersistedState(): boolean {
    if (!canPersistCurrentDailyGameplay({
      renderAccess: access,
      currentAccess: accessRef.current,
      renderSessionKey: sessionKey,
      currentSessionKey: activeSessionKeyRef.current,
      renderReadySessionKey: readySessionKey,
      currentReadySessionKey: readySessionKeyRef.current,
    })) return false;

    if (accessRef.current === 'owner') {
      const lifecycle = lifecycleRef.current;
      const current = contributionRef.current;
      if (lifecycle !== null && current !== null) {
        applyContribution(lifecycle.resetContribution(current));
      }
    } else {
      completionPolicyRef.current = { allowCreate: true, creationSubmissionId: null };
    }

    clearSavedDailyGame(puzzle, getDailyModeStorage(rulesetVersion));
    return true;
  }

  const exposedAccess = activeSessionKeyRef.current === sessionKey ? access : 'checking';
  const exposedContribution = activeSessionKeyRef.current === sessionKey ? contribution : null;
  return { access: exposedAccess, contribution: exposedContribution, resetPersistedState };
}

function sameOwnerDeliverySession(
  delivery: DailyAtBatOwnerDeliverySession | null,
  contribution: DailyAtBatContributionSession | null,
): delivery is DailyAtBatOwnerDeliverySession {
  return delivery !== null
    && contribution?.status === 'active'
    && delivery.attemptId === contribution.attemptId
    && delivery.generation === contribution.generation;
}

function sameActiveContribution(
  current: DailyAtBatContributionSession | null,
  expected: DailyAtBatContributionSession | null,
): current is Extract<DailyAtBatContributionSession, { status: 'active' }> {
  return current?.status === 'active'
    && expected?.status === 'active'
    && current.attemptId === expected.attemptId
    && current.generation === expected.generation;
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
    && isDailyModeSaveCompatible(rulesetVersion, loaded.savedGame.gameState.rulesetVersion)
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

