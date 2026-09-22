import { describe, expect, it, vi } from 'vitest';
import { POINTS_V3_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createDailyNineScorecardComparisonRequestController } from './dailyNineScorecardComparisonRequestController';

const baseKey = {
  kind: 'at-bat',
  puzzleId: 'daily-2026-09-22-editorial-test',
  puzzleDate: '2026-09-22',
  puzzleNumber: 149,
  rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
} as const;

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

describe('scorecard comparison request controller', () => {
  it('allows different completed pitches to resolve independently', async () => {
    const controller = createDailyNineScorecardComparisonRequestController();
    const first = deferred<number>();
    const second = deferred<number>();
    const firstSuccess = vi.fn();
    const secondSuccess = vi.fn();

    const firstRequest = controller.request({ ...baseKey, pitchNumber: 1 }, callbacks(first, firstSuccess));
    const secondRequest = controller.request({ ...baseKey, pitchNumber: 2 }, callbacks(second, secondSuccess));

    second.resolve(22);
    await secondRequest;
    first.resolve(11);
    await firstRequest;

    expect(firstSuccess).toHaveBeenCalledWith(11);
    expect(secondSuccess).toHaveBeenCalledWith(22);
  });

  it('suppresses a replaced same-pitch response', async () => {
    const controller = createDailyNineScorecardComparisonRequestController();
    const stale = deferred<number>();
    const fresh = deferred<number>();
    const staleSuccess = vi.fn();
    const freshSuccess = vi.fn();

    const staleRequest = controller.request({ ...baseKey, pitchNumber: 1 }, callbacks(stale, staleSuccess));
    const freshRequest = controller.request({ ...baseKey, pitchNumber: 1 }, callbacks(fresh, freshSuccess));

    stale.resolve(1);
    fresh.resolve(2);
    await Promise.all([staleRequest, freshRequest]);

    expect(staleSuccess).not.toHaveBeenCalled();
    expect(freshSuccess).toHaveBeenCalledWith(2);
  });

  it('suppresses late callbacks after session invalidation', async () => {
    const controller = createDailyNineScorecardComparisonRequestController();
    const pending = deferred<number>();
    const success = vi.fn();
    const error = vi.fn();

    const request = controller.request(
      { ...baseKey, pitchNumber: 4 },
      callbacks(pending, success, error),
    );
    controller.invalidateAll();
    pending.resolve(4);
    await request;

    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

function callbacks<T>(
  pending: Deferred<T>,
  onSuccess = vi.fn(),
  onError = vi.fn(),
) {
  return {
    onStart: vi.fn(),
    execute: () => pending.promise,
    onSuccess,
    onError,
    onSettled: vi.fn(),
  };
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
