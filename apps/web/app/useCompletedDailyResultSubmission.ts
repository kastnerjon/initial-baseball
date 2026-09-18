'use client';

import { useCallback, useEffect } from 'react';
import type { DailyGameState } from '@initial-baseball/shared';
import { submitCompletedDailyResultIfNeeded } from './dailyCompletedResultClient';

export function useCompletedDailyResultSubmission(
  hasLoadedSavedState: boolean,
  gameState: DailyGameState,
) {
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

  const submitCreationIfEligible = useCallback(({
    allowCreate,
    creationSubmissionId = null,
  }: {
    allowCreate: boolean;
    creationSubmissionId?: string | null;
  }): void => {
    if (!hasLoadedSavedState || !allowCreate || gameState.status !== 'completed') return;

    void submitCompletedDailyResultIfNeeded({
      puzzle: gameState.puzzle,
      rulesetVersion: gameState.rulesetVersion,
      completedAtBats: gameState.completedAtBats,
    }, {
      allowCreate: true,
      creationSubmissionId,
    });
  }, [
    gameState.completedAtBats,
    gameState.puzzle,
    gameState.rulesetVersion,
    gameState.status,
    hasLoadedSavedState,
  ]);

  return { submitCreationIfEligible };
}
