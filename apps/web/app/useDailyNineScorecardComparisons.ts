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
const MAX_CONCURRENT_SCORECARD_READS = 3;
const LOW_SAMPLE_RETRY_DELAY_MS = 1000;

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
  const retryTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const retryBudgetRef = useRef(new Map<number, number>());
  const [cache, setCache] = useState<ScorecardComparisonCache>(() => ({
    identityKey,
    byPitch: {},
  }));

  const invalidate = useCallback(() => {
    controller.invalidateAll();
    clearRetryRuntime(retryTimersRef.current, retryBudgetRef.current);
    lastPitchSignatureRef.current = '';
    setCache({ identityKey, byPitch: {} });
  }, [controller, identityKey]);

  useEffect(() => () => {
    controller.invalidateAll();
    clearRetryRuntime(retryTimersRef.current, retryBudgetRef.current);
  }, [controller]);

  useEffect(() => {
    if (cache.identityKey !== identityKey) {
      controller.invalidateAll();
      clearRetryRuntime(retryTimersRef.current, retryBudgetRef.current);
      lastPitchSignatureRef.current = '';
      setCache({ identityKey, byPitch: {} });
      return;
    }

    const completedSet = new Set(normalizedPitchNumbers);
    const stalePitchNumbers = Object.keys(cache.byPitch)
      .map(Number)
      .filter(pitchNumber => !completedSet.has(pitchNumber));
    if (stalePitchNumbers.length > 0) {
      for (const pitchNumber of stalePitchNumbers) {
        controller.invalidatePitch(pitchNumber);
        clearPitchRetry(pitchNumber, retryTimersRef.current, retryBudgetRef.current);
      }
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
    if (completionAdvanced) {
      for (const pitchNumber of normalizedPitchNumbers) {
        const state = cache.byPitch[pitchNumber];
        if (state !== undefined && shouldRefreshWithNewCompletion(state)) {
          const timer = retryTimersRef.current.get(pitchNumber);
          if (timer !== undefined) clearTimeout(timer);
          retryTimersRef.current.delete(pitchNumber);
          retryBudgetRef.current.set(pitchNumber, 0);
        }
      }
    }

    const loadingCount = Object.values(cache.byPitch)
      .filter(state => state.status === 'loading').length;
    let availableSlots = Math.max(0, MAX_CONCURRENT_SCORECARD_READS - loadingCount);
    if (availableSlots === 0) return;

    const missingPitchNumbers = normalizedPitchNumbers
      .filter(pitchNumber => cache.byPitch[pitchNumber] === undefined);
    const refreshPitchNumbers = completionAdvanced
      ? normalizedPitchNumbers.filter((pitchNumber) => {
          const state = cache.byPitch[pitchNumber];
          return state !== undefined && shouldRefreshWithNewCompletion(state);
        })
      : [];

    for (const pitchNumber of [...missingPitchNumbers, ...refreshPitchNumbers]) {
      if (availableSlots === 0) break;
      availableSlots -= 1;
      if (!retryBudgetRef.current.has(pitchNumber)) retryBudgetRef.current.set(pitchNumber, 0);

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
          const next: DailyNineScorecardComparisonState = {
            status: 'success',
            resolvedAtBatCount: comparison.resolvedAtBatCount,
            averagePoints: comparison.averagePoints,
          };
          updatePitch(pitchNumber, next);
          if (shouldRefreshWithNewCompletion(next)) scheduleOneRetry(pitchNumber);
          else clearPitchRetry(pitchNumber, retryTimersRef.current, retryBudgetRef.current);
        },
        onError: () => {
          updatePitch(pitchNumber, { status: 'unavailable' });
          scheduleOneRetry(pitchNumber);
        },
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

    function scheduleOneRetry(pitchNumber: number): void {
      const used = retryBudgetRef.current.get(pitchNumber) ?? 0;
      if (used >= 1 || retryTimersRef.current.has(pitchNumber)) return;

      retryBudgetRef.current.set(pitchNumber, used + 1);
      const timer = setTimeout(() => {
        retryTimersRef.current.delete(pitchNumber);
        setCache((current) => {
          if (current.identityKey !== identityKey) return current;
          const currentPitch = current.byPitch[pitchNumber];
          if (currentPitch === undefined || !shouldRefreshWithNewCompletion(currentPitch)) {
            return current;
          }
          const byPitch = { ...current.byPitch };
          delete byPitch[pitchNumber];
          return { identityKey, byPitch };
        });
      }, LOW_SAMPLE_RETRY_DELAY_MS);
      retryTimersRef.current.set(pitchNumber, timer);
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

function clearPitchRetry(
  pitchNumber: number,
  timers: Map<number, ReturnType<typeof setTimeout>>,
  budget: Map<number, number>,
): void {
  const timer = timers.get(pitchNumber);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(pitchNumber);
  budget.delete(pitchNumber);
}

function clearRetryRuntime(
  timers: Map<number, ReturnType<typeof setTimeout>>,
  budget: Map<number, number>,
): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  budget.clear();
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
