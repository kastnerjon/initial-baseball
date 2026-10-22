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

  it('serializes Custom hint/resolve even before React can paint busy', async () => {
    const requests = createDailyGameplayRequestController();
    const hint = deferred<string>();
    const hintStart = vi.fn();
    const guessStart = vi.fn();
    const first = requests.request({
      execute: () => hint.promise, onStart: hintStart,
      onSuccess: vi.fn(), onError: vi.fn(), onSettled: vi.fn(),
    });
    const duplicate = await requests.request({
      execute: async () => 'competing guess', onStart: guessStart,
      onSuccess: vi.fn(), onError: vi.fn(), onSettled: vi.fn(),
    });
    expect(duplicate).toBe(false);
    expect(hintStart).toHaveBeenCalledOnce();
    expect(guessStart).not.toHaveBeenCalled();
    hint.resolve('authorized hint');
    await first;
  });

  it('keeps a newer Custom restoration intact after obsolete action and completion callbacks', async () => {
    const requests = createDailyGameplayRequestController();
    const staleAction = deferred<string>();
    const restored = deferred<string>();
    const oldCompletion = deferred<string>();
    const oldSuccess = vi.fn();
    const oldError = vi.fn();
    const oldSettled = vi.fn();
    let screen = 'first attempt';

    const action = requests.request({
      execute: () => staleAction.promise, onStart: () => { screen = 'checking'; },
      onSuccess: oldSuccess, onError: oldError, onSettled: oldSettled,
    });
    requests.invalidate();
    const replacement = requests.request({
      execute: () => restored.promise, onStart: () => { screen = 'opening'; },
      onSuccess: value => { screen = value; }, onError: vi.fn(),
      onSettled: () => { screen += ' ready'; },
    });

    staleAction.reject(new Error('obsolete transport error'));
    await action;
    expect(oldError).not.toHaveBeenCalled();
    expect(oldSettled).not.toHaveBeenCalled();
    expect(screen).toBe('opening');
    restored.resolve('server-authoritative continuation');
    await replacement;
    expect(screen).toBe('server-authoritative continuation ready');

    const completion = requests.request({
      execute: () => oldCompletion.promise, onStart: vi.fn(),
      onSuccess: oldSuccess, onError: oldError, onSettled: oldSettled,
    });
    requests.invalidate();
    oldCompletion.resolve('saved');
    await completion;
    expect(oldSuccess).not.toHaveBeenCalled();
    expect(oldSettled).not.toHaveBeenCalled();
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
