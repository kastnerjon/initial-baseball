import { describe, expect, it, vi } from 'vitest';
import {
  createDailyGameplayRequestController,
  runDailyGameplayRequest,
} from './dailyGameplayRequestController';

describe('Daily gameplay request lifetime', () => {
  it('enforces synchronous single-flight before React state can rerender', () => {
    const controller = createDailyGameplayRequestController();
    const first = controller.begin();
    expect(first).not.toBeNull();
    expect(controller.begin()).toBeNull();

    if (first === null) throw new Error('Expected first request token');
    expect(controller.finish(first)).toBe(true);
    expect(controller.begin()).not.toBeNull();
  });

  it('keeps a new pending request intact when an invalidated old success settles', async () => {
    const controller = createDailyGameplayRequestController();
    const oldResponse = deferred<string>();
    const newResponse = deferred<string>();
    let pending: string | null = null;
    const oldError = vi.fn();

    const oldRequest = runDailyGameplayRequest({
      controller,
      request: () => oldResponse.promise,
      onStart: () => { pending = 'old'; },
      onError: oldError,
      onFinish: () => { pending = null; },
    });
    expect(pending).toBe('old');

    controller.invalidate();
    pending = null;

    const newRequest = runDailyGameplayRequest({
      controller,
      request: () => newResponse.promise,
      onStart: () => { pending = 'new'; },
      onError: () => { throw new Error('Fresh request should not fail'); },
      onFinish: () => { pending = null; },
    });
    expect(pending).toBe('new');

    oldResponse.resolve('stale');
    await expect(oldRequest).resolves.toBeNull();
    expect(oldError).not.toHaveBeenCalled();
    expect(pending).toBe('new');

    newResponse.resolve('fresh');
    await expect(newRequest).resolves.toBe('fresh');
    expect(pending).toBeNull();
  });

  it('suppresses stale errors and cleanup after invalidation', async () => {
    const controller = createDailyGameplayRequestController();
    const response = deferred<string>();
    const onError = vi.fn();
    const onFinish = vi.fn();

    const request = runDailyGameplayRequest({
      controller,
      request: () => response.promise,
      onStart: vi.fn(),
      onError,
      onFinish,
    });

    controller.invalidate();
    response.reject(new Error('old request failed'));

    await expect(request).resolves.toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('reports and cleans up a failure only while that request is current', async () => {
    const controller = createDailyGameplayRequestController();
    const onError = vi.fn();
    const onFinish = vi.fn();

    await expect(runDailyGameplayRequest({
      controller,
      request: async () => { throw new Error('network'); },
      onStart: vi.fn(),
      onError,
      onFinish,
    })).resolves.toBeNull();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(controller.begin()).not.toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
