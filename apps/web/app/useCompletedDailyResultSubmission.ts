'use client';

import { useEffect } from 'react';
import type { DailyGameState } from '@initial-baseball/shared';
import { submitCompletedDailyResultIfNeeded } from './dailyCompletedResultClient';

export function useCompletedDailyResultSubmission(
  hasLoadedSavedState: boolean,
  allowCreate: boolean,
  gameState: DailyGameState,
): void {
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
}
