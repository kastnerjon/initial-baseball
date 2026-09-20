'use client';

import type { DailyNineComparisonRequestKey } from './dailyNineComparisonClient';

type DailyNineComparisonRequestChannel = DailyNineComparisonRequestKey['kind'];

type DailyNineComparisonRequestCallbacks<T> = {
  execute: (signal: AbortSignal) => Promise<T>;
  onStart: () => void;
  onSuccess: (value: T) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

type RequestIdentity = {
  generation: number;
  requestId: number;
  key: DailyNineComparisonRequestKey;
  abortController: AbortController;
};

type ChannelState = {
  generation: number;
  active: RequestIdentity | null;
};

export type DailyNineComparisonRequestController = {
  request<T>(
    key: DailyNineComparisonRequestKey,
    callbacks: DailyNineComparisonRequestCallbacks<T>,
  ): Promise<void>;
  invalidate(channel: DailyNineComparisonRequestChannel): void;
  invalidateAll(): void;
};

export function createDailyNineComparisonRequestController(): DailyNineComparisonRequestController {
  const channels: Record<DailyNineComparisonRequestChannel, ChannelState> = {
    'at-bat': { generation: 0, active: null },
    completed: { generation: 0, active: null },
  };
  let nextRequestId = 0;

  return {
    request,
    invalidate,
    invalidateAll,
  };

  async function request<T>(
    key: DailyNineComparisonRequestKey,
    callbacks: DailyNineComparisonRequestCallbacks<T>,
  ): Promise<void> {
    const channel = key.kind;
    invalidate(channel);

    const state = channels[channel];
    const identity: RequestIdentity = {
      generation: state.generation,
      requestId: ++nextRequestId,
      key: cloneKey(key),
      abortController: new AbortController(),
    };
    state.active = identity;

    try {
      callbacks.onStart();
      const value = await callbacks.execute(identity.abortController.signal);
      if (isCurrent(identity)) callbacks.onSuccess(value);
    } catch (error) {
      if (isCurrent(identity)) callbacks.onError(error);
    } finally {
      if (isCurrent(identity)) {
        channels[channel].active = null;
        callbacks.onSettled();
      }
    }
  }

  function invalidate(channel: DailyNineComparisonRequestChannel): void {
    const state = channels[channel];
    state.generation += 1;
    const active = state.active;
    state.active = null;
    active?.abortController.abort();
  }

  function invalidateAll(): void {
    invalidate('at-bat');
    invalidate('completed');
  }

  function isCurrent(identity: RequestIdentity): boolean {
    const current = channels[identity.key.kind].active;
    return current !== null
      && current.generation === identity.generation
      && current.requestId === identity.requestId
      && sameKey(current.key, identity.key);
  }
}

function cloneKey(key: DailyNineComparisonRequestKey): DailyNineComparisonRequestKey {
  return key.kind === 'at-bat'
    ? { ...key }
    : { ...key };
}

function sameKey(a: DailyNineComparisonRequestKey, b: DailyNineComparisonRequestKey): boolean {
  if (a.kind !== b.kind) return false;
  if (a.puzzleId !== b.puzzleId
    || a.puzzleDate !== b.puzzleDate
    || a.puzzleNumber !== b.puzzleNumber
    || a.rulesetVersion !== b.rulesetVersion) return false;
  return a.kind === 'completed'
    || (b.kind === 'at-bat' && a.pitchNumber === b.pitchNumber);
}
