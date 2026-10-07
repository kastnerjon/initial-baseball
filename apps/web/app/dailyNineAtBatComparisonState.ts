import { getDailyNineStrictLowerAtBatRate } from '@initial-baseball/daily/comparison';
import {
  isDailyNineComparisonApiRulesetVersion,
  type DailyNineComparisonApiRulesetVersion,
  type DailyGuessResult,
  type DailyPublicPuzzle,
  type DailyPublicPuzzlePitch,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import type { DailyNineAtBatComparisonRequestKey } from './dailyNineComparisonClient';

export type DailyNineAtBatComparisonState =
  | { status: 'idle' }
  | { status: 'loading'; ownPoints: number }
  | {
      status: 'success';
      ownPoints: number;
      resolvedAtBatCount: number;
      averagePoints: number | null;
      strictLowerAtBatRate: number | null;
    }
  | { status: 'unavailable'; ownPoints: number };

export type DailyNineAtBatComparisonReadState =
  | { status: 'idle' | 'loading' }
  | {
      status: 'success';
      resolvedAtBatCount: number;
      averagePoints: number | null;
      rulesetVersion?: DailyNineComparisonApiRulesetVersion;
      scoreHistogram?: number[];
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
  if (!isDailyNineComparisonApiRulesetVersion(rulesetVersion) || pitch === null) return null;

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
      rulesetVersion,
      pitchNumber: pitch.pitchNumber,
    },
    ownPoints,
  };
}

export function createDailyNineAtBatComparisonState(
  readState: DailyNineAtBatComparisonReadState | undefined,
  ownPoints: number | null,
): DailyNineAtBatComparisonState {
  if (ownPoints === null) return { status: 'idle' };
  if (readState?.status === 'success') {
    const strictLowerAtBatRate = readState.rulesetVersion === undefined
      || readState.scoreHistogram === undefined
      ? null
      : getDailyNineStrictLowerAtBatRate({
          rulesetVersion: readState.rulesetVersion,
          resolvedAtBatCount: readState.resolvedAtBatCount,
          scoreHistogram: readState.scoreHistogram,
        }, ownPoints);
    return {
      status: 'success',
      ownPoints,
      resolvedAtBatCount: readState.resolvedAtBatCount,
      averagePoints: readState.averagePoints,
      strictLowerAtBatRate,
    };
  }
  if (readState?.status === 'unavailable') {
    return { status: 'unavailable', ownPoints };
  }
  return { status: 'loading', ownPoints };
}
