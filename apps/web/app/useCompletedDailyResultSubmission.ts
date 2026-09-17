'use client';

import { useEffect } from 'react';
import type { DailyGameState } from '@initial-baseball/shared';
import {
  clearCompletedDailyResultSubmission,
  submitCompletedDailyResultIfNeeded,
} from './dailyCompletedResultClient';

export function useCompletedDailyResultSubmission(
  hasLoadedSavedState: boolean,
  gameState: DailyGameState,
): () => void {
  useEffect(() => {
    if (!hasLoadedSavedState || gameState.status !== 'completed') return;

    void submitCompletedDailyResultIfNeeded({
      puzzle: gameState.puzzle,
      rulesetVersion: gameState.rulesetVersion,
      completedAtBats: gameState.completedAtBats,
    });
  }, [
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
