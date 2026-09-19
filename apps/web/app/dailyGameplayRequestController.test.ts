import { describe, expect, it } from 'vitest';
import { createDailyGameplayRequestController } from './dailyGameplayRequestController';

describe('Daily gameplay request controller', () => {
  it('enforces synchronous single-flight ownership', () => {
    const controller = createDailyGameplayRequestController();
    const first = controller.begin();
    expect(first).not.toBeNull();
    if (first === null) return;

    expect(controller.begin()).toBeNull();
    expect(controller.isCurrent(first)).toBe(true);
    expect(controller.finish(first)).toBe(true);
    expect(controller.isCurrent(first)).toBe(false);

    const second = controller.begin();
    expect(second).not.toBeNull();
    expect(second).not.toEqual(first);
  });

  it('fences stale success, error, and finally work after invalidation', () => {
    const controller = createDailyGameplayRequestController();
    const oldRequest = controller.begin();
    expect(oldRequest).not.toBeNull();
    if (oldRequest === null) return;

    controller.invalidate();
    const freshRequest = controller.begin();
    expect(freshRequest).not.toBeNull();
    if (freshRequest === null) return;

    expect(controller.isCurrent(oldRequest)).toBe(false);
    expect(controller.finish(oldRequest)).toBe(false);
    expect(controller.isCurrent(freshRequest)).toBe(true);
    expect(controller.begin()).toBeNull();
    expect(controller.finish(freshRequest)).toBe(true);
  });
});
