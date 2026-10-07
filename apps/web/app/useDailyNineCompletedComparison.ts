'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDailyNineStrictLowerFinishRate } from '@initial-baseball/daily/comparison';
import {
  isDailyNineComparisonApiRulesetVersion,
  type DailyPointsSummary,
  type DailyPublicPuzzle,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import {
  createBrowserDailyNineComparisonClient,
  type DailyNineCompletedComparisonRequestKey,
} from './dailyNineComparisonClient';
import { createDailyNineComparisonRequestController } from './dailyNineComparisonRequestController';

export type DailyNineCompletedComparisonState =
  | { status: 'idle' }
  | { status: 'loading'; ownPoints: number }
  | {
      status: 'success';
      ownPoints: number | null;
      completedGameCount: number;
      averageTotalPoints: number | null;
      strictLowerFinishRate: number | null;
    }
  | { status: 'unavailable'; ownPoints: number };

export type DailyNineCompletedComparisonInput = {
  key: DailyNineCompletedComparisonRequestKey;
  ownPoints: number | null;
} | null;

type DailyNineCompletedComparisonSourceInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  points: Pick<DailyPointsSummary, 'points' | 'completed'>;
  terminalPoints: Pick<DailyPointsSummary, 'points' | 'completed'> | null;
  excludedResultId?: string | null;
};

export function createDailyNineCompletedComparisonInput({
  puzzle,
  rulesetVersion,
  points,
  terminalPoints,
  excludedResultId,
}: DailyNineCompletedComparisonSourceInput): DailyNineCompletedComparisonInput {
  if (!isDailyNineComparisonApiRulesetVersion(rulesetVersion)) return null;

  const ownPoints = terminalPoints?.completed === true
    ? terminalPoints.points
    : points.completed
      ? points.points
      : null;
  return {
    key: {
      kind: 'completed',
      puzzleId: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion,
      ...(excludedResultId == null ? {} : { excludedResultId }),
    },
    ownPoints,
  };
}

export function useDailyNineCompletedComparison(input: DailyNineCompletedComparisonInput) {
  const [client] = useState(createBrowserDailyNineComparisonClient);
  const [controller] = useState(createDailyNineComparisonRequestController);
  const [state, setState] = useState<DailyNineCompletedComparisonState>({ status: 'idle' });

  const puzzleId = input?.key.puzzleId ?? null;
  const puzzleDate = input?.key.puzzleDate ?? null;
  const puzzleNumber = input?.key.puzzleNumber ?? null;
  const rulesetVersion = input?.key.rulesetVersion ?? null;
  const ownPoints = input?.ownPoints ?? null;
  const excludedResultId = input?.key.excludedResultId ?? null;

  const invalidate = useCallback(() => {
    controller.invalidate('completed');
  }, [controller]);

  useEffect(() => {
    if (puzzleId === null
      || puzzleDate === null
      || puzzleNumber === null
      || rulesetVersion === null
) {
      controller.invalidate('completed');
      setState({ status: 'idle' });
      return;
    }

    const key: DailyNineCompletedComparisonRequestKey = {
      kind: 'completed',
      puzzleId,
      puzzleDate,
      puzzleNumber,
      rulesetVersion,
      ...(excludedResultId === null ? {} : { excludedResultId }),
    };

    void controller.request(key, {
      onStart: () => setState({ status: 'loading', ownPoints }),
      execute: signal => client.readCompleted(key, signal),
      onSuccess: ({ comparison }) => {
        setState({
          status: 'success',
          ownPoints,
          completedGameCount: comparison.completedGameCount,
          averageTotalPoints: comparison.averageTotalPoints,
          strictLowerFinishRate: ownPoints === null
            ? null
            : getDailyNineStrictLowerFinishRate(comparison, ownPoints),
        });
      },
      onError: () => setState({ status: 'unavailable', ownPoints }),
      onSettled: () => undefined,
    });

    return () => {
      controller.invalidate('completed');
    };
  }, [
    client,
    controller,
    excludedResultId,
    ownPoints,
    puzzleDate,
    puzzleId,
    puzzleNumber,
    rulesetVersion,
  ]);

  return { state, invalidate };
}
