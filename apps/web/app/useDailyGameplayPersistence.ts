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

export type DailyGameplayAccess = 'checking' | 'owner' | 'follower' | 'compatibility' | 'unsupported';

export function useDailyGameplayPersistence({
  puzzle,
  rulesetVersion,
  initialProgressionToken,
  hasLoadedSavedState,
  saveInput,
  onRestore,
  setCompletedResultCreationAllowed,
}: {
  puzzle: DailyPublicPuzzle;
  rulesetVersion: DailyRulesetVersion;
  initialProgressionToken: string;
  hasLoadedSavedState: boolean;
  saveInput: SaveDailyGameInput;
  onRestore: (loaded: LoadedSavedDailyGame | null) => void;
  setCompletedResultCreationAllowed: (allow: boolean) => void;
}) {
  const [access, setAccess] = useState<DailyGameplayAccess>('checking');
  const [contribution, setContribution] = useState<DailyAtBatContributionSession | null>(null);
  const accessRef = useRef(access);
  const contributionRef = useRef(contribution);
  const lifecycleRef = useRef<ReturnType<typeof createBrowserDailyAtBatGameplayLifecycle> | null>(null);
  const restoreRef = useRef(onRestore);
  const completedResultRef = useRef(setCompletedResultCreationAllowed);
  accessRef.current = access;
  contributionRef.current = contribution;
  restoreRef.current = onRestore;
  completedResultRef.current = setCompletedResultCreationAllowed;

  useEffect(() => {
    let cancelled = false;
    const storage = getDailyModeStorage(rulesetVersion);
    const initialLoaded = loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage);
    const coordinate = rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
      && (initialLoaded === null
        || initialLoaded.savedGame.gameState.rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION);

    setContribution(null);
    contributionRef.current = null;
    completedResultRef.current(false);

    if (!coordinate) {
      setAccess('compatibility');
      restoreCompatibility(initialLoaded);
      return () => { cancelled = true; };
    }

    const identity = {
      id: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    } as const;
    const lifecycle = createBrowserDailyAtBatGameplayLifecycle(identity, storage);
    lifecycleRef.current = lifecycle;
    const coordinator = createBrowserDailyAtBatOwnershipCoordinator({
      identity,
      journal: lifecycle.journal,
      reloadDurableState: ({ generation }) => {
        const loaded = loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage);
        const next = lifecycle.prepareOwner({
          loaded,
          hadPersistedGameplayValue: hasPersistedDailyGameValue(puzzle.puzzleDate, storage),
          claimedGeneration: generation,
          totalAtBats: puzzle.pitches.length,
        });
        if (cancelled) return;
        applyContribution(next);
        restoreRef.current(loaded);
      },
    });
    const unsubscribe = coordinator.subscribe((state) => {
      if (cancelled) return;
      if (state.status === 'owner') {
        setAccess('owner');
      } else if (state.status === 'follower') {
        setAccess('follower');
        completedResultRef.current(false);
      } else {
        setAccess('unsupported');
        setContribution(null);
        contributionRef.current = null;
        restoreCompatibility(loadCompatible(puzzle, rulesetVersion, initialProgressionToken, storage));
      }
    });
    setAccess('follower');
    coordinator.start();

    return () => {
      cancelled = true;
      unsubscribe();
      coordinator.stop();
      lifecycleRef.current = null;
    };

    function restoreCompatibility(loaded: LoadedSavedDailyGame | null) {
      const allow = compatibilityCompletedResultEligibility(loaded, puzzle.pitches.length);
      completedResultRef.current(allow);
      restoreRef.current(loaded);
    }
    function applyContribution(next: DailyAtBatContributionSession) {
      contributionRef.current = next;
      setContribution(next);
      completedResultRef.current(next.allowCompletedResultCreate);
    }
  }, [
    initialProgressionToken,
    puzzle,
    rulesetVersion,
  ]);

  useEffect(() => {
    if (!hasLoadedSavedState || access === 'checking' || access === 'follower') return;
    const saved = saveDailyGame(puzzle, saveInput, getDailyModeStorage(rulesetVersion));
    if (access !== 'owner' || saved) return;

    const lifecycle = lifecycleRef.current;
    const current = contributionRef.current;
    if (lifecycle === null || current === null || current.status !== 'active') return;
    const next = lifecycle.retireAfterGameplaySaveFailure(current);
    contributionRef.current = next;
    setContribution(next);
    completedResultRef.current(false);
  }, [
    access,
    hasLoadedSavedState,
    puzzle,
    rulesetVersion,
    saveInput.atBatState,
    saveInput.currentPitchIndex,
    saveInput.gameState,
    saveInput.pendingAdvance,
    saveInput.progressionToken,
    saveInput.scorecardAnswers,
  ]);

  function resetPersistedState(): boolean {
    if (accessRef.current === 'checking' || accessRef.current === 'follower') return false;

    if (accessRef.current === 'owner') {
      const lifecycle = lifecycleRef.current;
      const current = contributionRef.current;
      if (lifecycle !== null && current !== null) {
        const next = lifecycle.resetContribution(current);
        contributionRef.current = next;
        setContribution(next);
        completedResultRef.current(next.allowCompletedResultCreate);
      }
    } else {
      completedResultRef.current(true);
    }

    clearSavedDailyGame(puzzle, getDailyModeStorage(rulesetVersion));
    return true;
  }

  return { access, contribution, resetPersistedState };
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
