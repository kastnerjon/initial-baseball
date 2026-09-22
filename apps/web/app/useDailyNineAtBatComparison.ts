'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyGuessResult,
  type DailyPublicPuzzle,
  type DailyPublicPuzzlePitch,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import {
  createBrowserDailyNineComparisonClient,
  type DailyNineAtBatComparisonRequestKey,
} from './dailyNineComparisonClient';
import { createDailyNineComparisonRequestController } from './dailyNineComparisonRequestController';

export type DailyNineAtBatComparisonState =
  | { status: 'idle' }
  | { status: 'loading'; ownPoints: number }
  | {
      status: 'success';
      ownPoints: number;
      resolvedAtBatCount: number;
      averagePoints: number | null;
    }
  | { status: 'unavailable'; ownPoints: number };

export type DailyNineAtBatComparisonReadState =
  | { status: 'idle' | 'loading' }
  | {
      status: 'success';
      resolvedAtBatCount: number;
      averagePoints: number | null;
    }
  | { status: 'unavailable' };

export type DailyNineAtBatComparisonInput = {
  key: DailyNineAtBatComparisonRequestKey;
  ownPoints: number | null;
} | null;

type DailyNineAtBatComparisonActivationInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  pitch: Pick<DailyPublicPuzzlePitch, 'pitchNumber'> | null;
  result: DailyGuessResult | null;
  currentPoints: number;
  terminalPoints: number | null;
};

export function createDailyNineAtBatComparisonInput({
  puzzle,
  rulesetVersion,
  pitch,
  result,
  currentPoints,
  terminalPoints,
}: DailyNineAtBatComparisonActivationInput): DailyNineAtBatComparisonInput {
  if (rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION || pitch === null) return null;

  const ownPoints = result !== null
    && result.kind !== 'incorrect'
    && terminalPoints !== null
    ? Math.max(0, terminalPoints - currentPoints)
    : null;

  return {
    key: {
      kind: 'at-bat',
      puzzleId: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitchNumber: pitch.pitchNumber,
    },
    ownPoints,
  };
}

export function createDailyNineAtBatComparisonState(
  readState: DailyNineAtBatComparisonReadState,
  ownPoints: number | null,
): DailyNineAtBatComparisonState {
  if (ownPoints === null) return { status: 'idle' };
  if (readState.status === 'success') {
    return {
      status: 'success',
      ownPoints,
      resolvedAtBatCount: readState.resolvedAtBatCount,
      averagePoints: readState.averagePoints,
    };
  }
  if (readState.status === 'unavailable') {
    return { status: 'unavailable', ownPoints };
  }
  return { status: 'loading', ownPoints };
}

export function useDailyNineAtBatComparison(input: DailyNineAtBatComparisonInput) {
  const [client] = useState(createBrowserDailyNineComparisonClient);
  const [controller] = useState(createDailyNineComparisonRequestController);
  const [readState, setReadState] = useState<DailyNineAtBatComparisonReadState>({ status: 'idle' });

  const puzzleId = input?.key.puzzleId ?? null;
  const puzzleDate = input?.key.puzzleDate ?? null;
  const puzzleNumber = input?.key.puzzleNumber ?? null;
  const rulesetVersion = input?.key.rulesetVersion ?? null;
  const pitchNumber = input?.key.pitchNumber ?? null;
  const ownPoints = input?.ownPoints ?? null;
  const state = createDailyNineAtBatComparisonState(readState, ownPoints);

  const invalidate = useCallback(() => {
    controller.invalidate('at-bat');
    setReadState({ status: 'idle' });
  }, [controller]);

  useEffect(() => {
    if (puzzleId === null
      || puzzleDate === null
      || puzzleNumber === null
      || rulesetVersion === null
      || pitchNumber === null) {
      controller.invalidate('at-bat');
      setReadState({ status: 'idle' });
      return;
    }

    const key: DailyNineAtBatComparisonRequestKey = {
      kind: 'at-bat',
      puzzleId,
      puzzleDate,
      puzzleNumber,
      rulesetVersion,
      pitchNumber,
    };

    void controller.request(key, {
      onStart: () => setReadState({ status: 'loading' }),
      execute: signal => client.readAtBat(key, signal),
      onSuccess: ({ comparison }) => {
        setReadState({
          status: 'success',
          resolvedAtBatCount: comparison.resolvedAtBatCount,
          averagePoints: comparison.averagePoints,
        });
      },
      onError: () => setReadState({ status: 'unavailable' }),
      onSettled: () => undefined,
    });

    return () => {
      controller.invalidate('at-bat');
    };
    // ownPoints is intentionally excluded: terminal reveal projects the existing
    // active-slot read instead of restarting the comparison request.
  }, [
    client,
    controller,
    pitchNumber,
    puzzleDate,
    puzzleId,
    puzzleNumber,
    rulesetVersion,
  ]);

  return { state, invalidate };
}
