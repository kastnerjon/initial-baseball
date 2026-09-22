import type { DailyNineAtBatComparisonRequestKey } from './dailyNineComparisonClient';

type RequestCallbacks<T> = {
  execute: (signal: AbortSignal) => Promise<T>;
  onStart: () => void;
  onSuccess: (value: T) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

type RequestIdentity = {
  generation: number;
  requestId: number;
  key: DailyNineAtBatComparisonRequestKey;
  abortController: AbortController;
};

type PitchState = {
  generation: number;
  nextRequestId: number;
  active: RequestIdentity | null;
};

export type DailyNineScorecardComparisonRequestController = {
  request<T>(
    key: DailyNineAtBatComparisonRequestKey,
    callbacks: RequestCallbacks<T>,
  ): Promise<void>;
  invalidatePitch(pitchNumber: number): void;
  invalidateAll(): void;
};

export function createDailyNineScorecardComparisonRequestController():
DailyNineScorecardComparisonRequestController {
  const pitches = new Map<number, PitchState>();

  return { request, invalidatePitch, invalidateAll };

  async function request<T>(
    key: DailyNineAtBatComparisonRequestKey,
    callbacks: RequestCallbacks<T>,
  ): Promise<void> {
    invalidatePitch(key.pitchNumber);
    const state = getPitchState(key.pitchNumber);
    const identity: RequestIdentity = {
      generation: state.generation,
      requestId: ++state.nextRequestId,
      key: { ...key },
      abortController: new AbortController(),
    };
    state.active = identity;

    try {
      callbacks.onStart();
      if (!isCurrent(identity)) return;

      const value = await callbacks.execute(identity.abortController.signal);
      if (isCurrent(identity)) callbacks.onSuccess(value);
    } catch (error) {
      if (isCurrent(identity)) callbacks.onError(error);
    } finally {
      if (isCurrent(identity)) {
        getPitchState(identity.key.pitchNumber).active = null;
        callbacks.onSettled();
      }
    }
  }

  function invalidatePitch(pitchNumber: number): void {
    const state = getPitchState(pitchNumber);
    state.generation += 1;
    const active = state.active;
    state.active = null;
    active?.abortController.abort();
  }

  function invalidateAll(): void {
    for (const pitchNumber of pitches.keys()) invalidatePitch(pitchNumber);
  }

  function getPitchState(pitchNumber: number): PitchState {
    const existing = pitches.get(pitchNumber);
    if (existing !== undefined) return existing;

    const created: PitchState = { generation: 0, nextRequestId: 0, active: null };
    pitches.set(pitchNumber, created);
    return created;
  }

  function isCurrent(identity: RequestIdentity): boolean {
    const current = getPitchState(identity.key.pitchNumber).active;
    return current !== null
      && current.generation === identity.generation
      && current.requestId === identity.requestId
      && sameKey(current.key, identity.key);
  }
}

function sameKey(
  a: DailyNineAtBatComparisonRequestKey,
  b: DailyNineAtBatComparisonRequestKey,
): boolean {
  return a.puzzleId === b.puzzleId
    && a.puzzleDate === b.puzzleDate
    && a.puzzleNumber === b.puzzleNumber
    && a.rulesetVersion === b.rulesetVersion
    && a.pitchNumber === b.pitchNumber;
}
