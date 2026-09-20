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

export type DailyNineAtBatComparisonInput = {
  key: DailyNineAtBatComparisonRequestKey;
  ownPoints: number;
} | null;

type DailyNineTerminalAtBatComparisonInput = {
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
}: DailyNineTerminalAtBatComparisonInput): DailyNineAtBatComparisonInput {
  if (rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    || pitch === null
    || result === null
    || result.kind === 'incorrect'
    || terminalPoints === null) return null;

  return {
    key: {
      kind: 'at-bat',
      puzzleId: puzzle.id,
      puzzleDate: puzzle.puzzleDate,
      puzzleNumber: puzzle.puzzleNumber,
      rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
      pitchNumber: pitch.pitchNumber,
    },
    ownPoints: Math.max(0, terminalPoints - currentPoints),
  };
}

export function useDailyNineAtBatComparison(input: DailyNineAtBatComparisonInput) {
  const [client] = useState(createBrowserDailyNineComparisonClient);
  const [controller] = useState(createDailyNineComparisonRequestController);
  const [state, setState] = useState<DailyNineAtBatComparisonState>({ status: 'idle' });

  const puzzleId = input?.key.puzzleId ?? null;
  const puzzleDate = input?.key.puzzleDate ?? null;
  const puzzleNumber = input?.key.puzzleNumber ?? null;
  const rulesetVersion = input?.key.rulesetVersion ?? null;
  const pitchNumber = input?.key.pitchNumber ?? null;
  const ownPoints = input?.ownPoints ?? null;

  const invalidate = useCallback(() => {
    controller.invalidate('at-bat');
  }, [controller]);

  useEffect(() => {
    if (puzzleId === null
      || puzzleDate === null
      || puzzleNumber === null
      || rulesetVersion === null
      || pitchNumber === null
      || ownPoints === null) {
      controller.invalidate('at-bat');
      setState({ status: 'idle' });
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
      onStart: () => setState({ status: 'loading', ownPoints }),
      execute: signal => client.readAtBat(key, signal),
      onSuccess: ({ comparison }) => {
        setState({
          status: 'success',
          ownPoints,
          resolvedAtBatCount: comparison.resolvedAtBatCount,
          averagePoints: comparison.averagePoints,
        });
      },
      onError: () => setState({ status: 'unavailable', ownPoints }),
      onSettled: () => undefined,
    });

    return () => {
      controller.invalidate('at-bat');
    };
  }, [
    client,
    controller,
    ownPoints,
    pitchNumber,
    puzzleDate,
    puzzleId,
    puzzleNumber,
    rulesetVersion,
  ]);

  return { state, invalidate };
}
