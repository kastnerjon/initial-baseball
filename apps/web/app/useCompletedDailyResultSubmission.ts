'use client';

import { useEffect } from 'react';
import type { DailyGameState } from '@initial-baseball/shared';
import {
  clearCompletedDailyResultSubmission,
  submitCompletedDailyResultIfNeeded,
} from './dailyCompletedResultClient';

export function useCompletedDailyResultSubmission(
  hasLoadedSavedState: boolean,
  completedAtBatFactsAreNative: boolean,
  gameState: DailyGameState,
): () => void {
  useEffect(() => {
    if (!hasLoadedSavedState
      || !completedAtBatFactsAreNative
      || gameState.status !== 'completed') {
      return;
    }

    void submitCompletedDailyResultIfNeeded({
      puzzle: gameState.puzzle,
      rulesetVersion: gameState.rulesetVersion,
      completedAtBats: gameState.completedAtBats,
    });
  }, [
    completedAtBatFactsAreNative,
    gameState.completedAtBats,
    gameState.puzzle,
    gameState.rulesetVersion,
    gameState.status,
    hasLoadedSavedState,
  ]);

  return () => clearCompletedDailyResultSubmission({
    puzzle: gameState.puzzle,
    rulesetVersion: gameState.rulesetVersion,
  });
}
