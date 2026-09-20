import { describe, expect, it, vi } from 'vitest';
import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import {
  createDailyNineComparisonRequestController,
} from './dailyNineComparisonRequestController';
import type {
  DailyNineAtBatComparisonRequestKey,
  DailyNineCompletedComparisonRequestKey,
} from './dailyNineComparisonClient';

const BASE = {
  puzzleId: 'daily-2026-09-19-editorial-a9429f70',
  puzzleDate: '2026-09-19',
  puzzleNumber: 146,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

const COMPLETED_KEY: DailyNineCompletedComparisonRequestKey = {
  kind: 'completed',
  ...BASE,
};

describe('Daily Nine comparison request controller', () => {
  it('replaces an at-bat request and makes late success/settled callbacks inert', async () => {
    const controller = createDailyNineComparisonRequestController();
    const stale = deferred<string>();
    const fresh = deferred<string>();
    const staleSuccess = vi.fn();
    const staleSettled = vi.fn();
    const freshSuccess = vi.fn();
    let staleSignal: AbortSignal | undefined;
    let pending: string | null = null;

    const staleRun = controller.request(atBatKey(2), {
      execute: (signal) => {
        staleSignal = signal;
        return stale.promise;
      },
      onStart: () => { pending = 'pitch-2'; },
      onSuccess: staleSuccess,
      onError: vi.fn(),
      onSettled: () => {
        staleSettled();
        pending = null;
      },
    });

    expect(staleSignal?.aborted).toBe(false);

    const freshRun = controller.request(atBatKey(3), {
      execute: () => fresh.promise,
      onStart: () => { pending = 'pitch-3'; },
      onSuccess: freshSuccess,
      onError: vi.fn(),
      onSettled: () => { pending = null; },
    });

    expect(staleSignal?.aborted).toBe(true);
    expect(pending).toBe('pitch-3');

    stale.resolve('obsolete');
    await staleRun;

    expect(staleSuccess).not.toHaveBeenCalled();
    expect(staleSettled).not.toHaveBeenCalled();
    expect(pending).toBe('pitch-3');

    fresh.resolve('current');
    await freshRun;

    expect(freshSuccess).toHaveBeenCalledTimes(1);
    expect(freshSuccess).toHaveBeenCalledWith('current');
    expect(pending).toBeNull();
  });

  it('makes a delayed failure inert after explicit channel invalidation', async () => {
    const controller = createDailyNineComparisonRequestController();
    const stale = deferred<string>();
    const staleError = vi.fn();
    const staleSettled = vi.fn();
    let signal: AbortSignal | undefined;

    const run = controller.request(atBatKey(4), {
      execute: (requestSignal) => {
        signal = requestSignal;
        return stale.promise;
      },
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: staleError,
      onSettled: staleSettled,
    });

    controller.invalidate('at-bat');
    expect(signal?.aborted).toBe(true);

    stale.reject(new Error('late failure'));
    await run;

    expect(staleError).not.toHaveBeenCalled();
    expect(staleSettled).not.toHaveBeenCalled();
  });

  it('keeps at-bat and completed request channels independent', async () => {
    const controller = createDailyNineComparisonRequestController();
    const atBat = deferred<string>();
    const completed = deferred<string>();
    const completedSuccess = vi.fn();
    let atBatSignal: AbortSignal | undefined;
    let completedSignal: AbortSignal | undefined;

    const atBatRun = controller.request(atBatKey(9), {
      execute: (signal) => {
        atBatSignal = signal;
        return atBat.promise;
      },
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onSettled: vi.fn(),
    });
    const completedRun = controller.request(COMPLETED_KEY, {
      execute: (signal) => {
        completedSignal = signal;
        return completed.promise;
      },
      onStart: vi.fn(),
      onSuccess: completedSuccess,
      onError: vi.fn(),
      onSettled: vi.fn(),
    });

    controller.invalidate('at-bat');

    expect(atBatSignal?.aborted).toBe(true);
    expect(completedSignal?.aborted).toBe(false);

    atBat.resolve('obsolete');
    completed.resolve('final');
    await Promise.all([atBatRun, completedRun]);

    expect(completedSuccess).toHaveBeenCalledTimes(1);
    expect(completedSuccess).toHaveBeenCalledWith('final');
  });

  it('invalidates both channels together on session teardown', async () => {
    const controller = createDailyNineComparisonRequestController();
    const atBat = deferred<string>();
    const completed = deferred<string>();
    const atBatSuccess = vi.fn();
    const completedSuccess = vi.fn();
    let atBatSignal: AbortSignal | undefined;
    let completedSignal: AbortSignal | undefined;

    const runs = [
      controller.request(atBatKey(5), {
        execute: (signal) => {
          atBatSignal = signal;
          return atBat.promise;
        },
        onStart: vi.fn(),
        onSuccess: atBatSuccess,
        onError: vi.fn(),
        onSettled: vi.fn(),
      }),
      controller.request(COMPLETED_KEY, {
        execute: (signal) => {
          completedSignal = signal;
          return completed.promise;
        },
        onStart: vi.fn(),
        onSuccess: completedSuccess,
        onError: vi.fn(),
        onSettled: vi.fn(),
      }),
    ];

    controller.invalidateAll();

    expect(atBatSignal?.aborted).toBe(true);
    expect(completedSignal?.aborted).toBe(true);

    atBat.resolve('obsolete AB');
    completed.resolve('obsolete completed');
    await Promise.all(runs);

    expect(atBatSuccess).not.toHaveBeenCalled();
    expect(completedSuccess).not.toHaveBeenCalled();
  });

  it('does not execute a request invalidated synchronously during onStart', async () => {
    const controller = createDailyNineComparisonRequestController();
    const execute = vi.fn().mockResolvedValue('should not run');
    const onSettled = vi.fn();

    await controller.request(atBatKey(6), {
      execute,
      onStart: () => controller.invalidate('at-bat'),
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onSettled,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });
});

function atBatKey(pitchNumber: number): DailyNineAtBatComparisonRequestKey {
  return { kind: 'at-bat', ...BASE, pitchNumber };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
