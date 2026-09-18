'use client';

import { useEffect, useState } from 'react';
import type { DailyGameState } from '@initial-baseball/shared';
import { canCreateCompletedResultFromLoadedSave } from './dailyCompletedResultActivation';
import { submitCompletedDailyResultIfNeeded } from './dailyCompletedResultClient';
import type { SavedDailyGame } from './dailyLocalStorage';

export function useCompletedDailyResultSubmission(
  hasLoadedSavedState: boolean,
  gameState: DailyGameState,
) {
  const [allowCreate, setAllowCreate] = useState(false);

  useEffect(() => {
    if (!hasLoadedSavedState) return;

    void submitCompletedDailyResultIfNeeded({
      puzzle: gameState.puzzle,
      rulesetVersion: gameState.rulesetVersion,
      completedAtBats: [],
    }, { allowCreate: false });
  }, [
    gameState.puzzle,
    gameState.rulesetVersion,
    hasLoadedSavedState,
  ]);

  useEffect(() => {
    if (!hasLoadedSavedState || !allowCreate || gameState.status !== 'completed') return;

    void submitCompletedDailyResultIfNeeded({
      puzzle: gameState.puzzle,
      rulesetVersion: gameState.rulesetVersion,
      completedAtBats: gameState.completedAtBats,
    }, { allowCreate: true });
  }, [
    allowCreate,
    gameState.completedAtBats,
    gameState.puzzle,
    gameState.rulesetVersion,
    gameState.status,
    hasLoadedSavedState,
  ]);

  return {
    restoreEligibility(
      savedGame: SavedDailyGame,
      totalAtBats: number,
      completedAtBatFactsAreNative: boolean,
    ): void {
      setAllowCreate(canCreateCompletedResultFromLoadedSave({
        savedGame,
        totalAtBats,
        completedAtBatFactsAreNative,
      }));
    },
    allowFreshSession(): void {
      setAllowCreate(true);
    },
  };
}
