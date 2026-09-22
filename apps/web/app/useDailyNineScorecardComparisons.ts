'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyPublicPuzzle,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import {
  createBrowserDailyNineComparisonClient,
  type DailyNineAtBatComparisonRequestKey,
} from './dailyNineComparisonClient';
import { createDailyNineScorecardComparisonRequestController } from './dailyNineScorecardComparisonRequestController';

export type DailyNineScorecardComparisonState =
  | { status: 'loading' }
  | {
      status: 'success';
      resolvedAtBatCount: number;
      averagePoints: number | null;
    }
  | { status: 'unavailable' };

export type DailyNineScorecardComparisons = Record<number, DailyNineScorecardComparisonState>;

type ScorecardComparisonCache = {
  identityKey: string;
  byPitch: DailyNineScorecardComparisons;
};

type UseDailyNineScorecardComparisonsInput = {
  enabled: boolean;
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedPitchNumbers: number[];
};

const EMPTY_COMPARISONS: DailyNineScorecardComparisons = {};

export function useDailyNineScorecardComparisons({
  enabled,
  puzzle,
  rulesetVersion,
  completedPitchNumbers,
}: UseDailyNineScorecardComparisonsInput) {
  const [client] = useState(createBrowserDailyNineComparisonClient);
  const [controller] = useState(createDailyNineScorecardComparisonRequestController);
  const identityKey = createIdentityKey(puzzle, rulesetVersion);
  const normalizedPitchNumbers = [...new Set(completedPitchNumbers)].sort((a, b) => a - b);
  const pitchSignature = normalizedPitchNumbers.join(',');
  const lastPitchSignatureRef = useRef('');
  const [cache, setCache] = useState<ScorecardComparisonCache>(() => ({
    identityKey,
    byPitch: {},
  }));

  const invalidate = useCallback(() => {
    controller.invalidateAll();
    lastPitchSignatureRef.current = '';
    setCache({ identityKey, byPitch: {} });
  }, [controller, identityKey]);

  useEffect(() => () => {
    controller.invalidateAll();
  }, [controller]);

  useEffect(() => {
    if (cache.identityKey !== identityKey) {
      controller.invalidateAll();
      lastPitchSignatureRef.current = '';
      setCache({ identityKey, byPitch: {} });
      return;
    }

    const completedSet = new Set(normalizedPitchNumbers);
    const stalePitchNumbers = Object.keys(cache.byPitch)
      .map(Number)
      .filter(pitchNumber => !completedSet.has(pitchNumber));
    if (stalePitchNumbers.length > 0) {
      for (const pitchNumber of stalePitchNumbers) controller.invalidatePitch(pitchNumber);
      setCache(current => {
        if (current.identityKey !== identityKey) return current;
        const byPitch = { ...current.byPitch };
        for (const pitchNumber of stalePitchNumbers) delete byPitch[pitchNumber];
        return { identityKey, byPitch };
      });
      return;
    }

    if (!enabled || rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION) return;

    const completionAdvanced = lastPitchSignatureRef.current !== pitchSignature;
    lastPitchSignatureRef.current = pitchSignature;

    for (const pitchNumber of normalizedPitchNumbers) {
      const current = cache.byPitch[pitchNumber];
      if (current !== undefined
        && !(completionAdvanced && shouldRefreshWithNewCompletion(current))) continue;

      const key: DailyNineAtBatComparisonRequestKey = {
        kind: 'at-bat',
        puzzleId: puzzle.id,
        puzzleDate: puzzle.puzzleDate,
        puzzleNumber: puzzle.puzzleNumber,
        rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
        pitchNumber,
      };

      void controller.request(key, {
        onStart: () => updatePitch(pitchNumber, { status: 'loading' }),
        execute: signal => client.readAtBat(key, signal),
        onSuccess: ({ comparison }) => {
          updatePitch(pitchNumber, {
            status: 'success',
            resolvedAtBatCount: comparison.resolvedAtBatCount,
            averagePoints: comparison.averagePoints,
          });
        },
        onError: () => updatePitch(pitchNumber, { status: 'unavailable' }),
        onSettled: () => undefined,
      });
    }

    function updatePitch(
      pitchNumber: number,
      next: DailyNineScorecardComparisonState,
    ): void {
      setCache(current => current.identityKey !== identityKey
        ? current
        : {
            identityKey,
            byPitch: { ...current.byPitch, [pitchNumber]: next },
          });
    }
  }, [
    cache,
    client,
    controller,
    enabled,
    identityKey,
    pitchSignature,
    puzzle.id,
    puzzle.puzzleDate,
    puzzle.puzzleNumber,
    rulesetVersion,
  ]);

  const comparisons = enabled
    && rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
    && cache.identityKey === identityKey
    ? cache.byPitch
    : EMPTY_COMPARISONS;

  return { comparisons, invalidate };
}

function shouldRefreshWithNewCompletion(state: DailyNineScorecardComparisonState): boolean {
  return state.status === 'unavailable'
    || (state.status === 'success' && state.resolvedAtBatCount <= 1);
}

function createIdentityKey(
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>,
  rulesetVersion: DailyRulesetVersion,
): string {
  return [
    puzzle.id,
    puzzle.puzzleDate,
    String(puzzle.puzzleNumber),
    rulesetVersion,
  ].join('|');
}
