import { describe, expect, it, vi } from 'vitest';
import { createDailyGameplayRequestController } from './dailyGameplayRequestController';

describe('daily gameplay request controller', () => {
  it('admits only one request synchronously', async () => {
    const controller = createDailyGameplayRequestController();
    const first = deferred<string>();
    const firstSuccess = vi.fn();

    const firstRun = controller.request({
      execute: () => first.promise,
      onStart: vi.fn(),
      onSuccess: firstSuccess,
      onError: vi.fn(),
      onSettled: vi.fn(),
    });

    const secondStart = vi.fn();
    const secondAccepted = await controller.request({
      execute: async () => 'second',
      onStart: secondStart,
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onSettled: vi.fn(),
    });

    expect(secondAccepted).toBe(false);
    expect(secondStart).not.toHaveBeenCalled();

    first.resolve('first');
    await firstRun;
    expect(firstSuccess).toHaveBeenCalledWith('first');
  });

  it('makes delayed success inert after reset while preserving the replacement request', async () => {
    const controller = createDailyGameplayRequestController();
    const stale = deferred<string>();
    const fresh = deferred<string>();
    const staleSuccess = vi.fn();
    const staleSettled = vi.fn();
    const freshSuccess = vi.fn();
    let pending: 'stale' | 'fresh' | null = null;

    const staleRun = controller.request({
      execute: () => stale.promise,
      onStart: () => { pending = 'stale'; },
      onSuccess: staleSuccess,
      onError: vi.fn(),
      onSettled: () => {
        staleSettled();
        pending = null;
      },
    });
    expect(pending).toBe('stale');

    controller.invalidate();
    pending = null;

    const freshRun = controller.request({
      execute: () => fresh.promise,
      onStart: () => { pending = 'fresh'; },
      onSuccess: freshSuccess,
      onError: vi.fn(),
      onSettled: () => { pending = null; },
    });
    expect(pending).toBe('fresh');

    stale.resolve('obsolete');
    await staleRun;

    expect(staleSuccess).not.toHaveBeenCalled();
    expect(staleSettled).not.toHaveBeenCalled();
    expect(pending).toBe('fresh');

    fresh.resolve('current');
    await freshRun;

    expect(freshSuccess).toHaveBeenCalledWith('current');
    expect(pending).toBeNull();
  });

  it('makes delayed failure inert after reset and cannot clear a newer pending request', async () => {
    const controller = createDailyGameplayRequestController();
    const stale = deferred<string>();
    const fresh = deferred<string>();
    const staleError = vi.fn();
    const staleSettled = vi.fn();
    let pending: 'stale' | 'fresh' | null = null;

    const staleRun = controller.request({
      execute: () => stale.promise,
      onStart: () => { pending = 'stale'; },
      onSuccess: vi.fn(),
      onError: staleError,
      onSettled: () => {
        staleSettled();
        pending = null;
      },
    });

    controller.invalidate();
    pending = null;

    const freshRun = controller.request({
      execute: () => fresh.promise,
      onStart: () => { pending = 'fresh'; },
      onSuccess: vi.fn(),
      onError: vi.fn(),
      onSettled: () => { pending = null; },
    });

    stale.reject(new Error('obsolete failure'));
    await staleRun;

    expect(staleError).not.toHaveBeenCalled();
    expect(staleSettled).not.toHaveBeenCalled();
    expect(pending).toBe('fresh');

    fresh.resolve('current');
    await freshRun;
    expect(pending).toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
