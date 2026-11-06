import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DailyHintBundle } from './dailyRuntimeContracts';
import { createDailyOnDemandHintRequestClient } from './dailyOnDemandHintRequestClient';

const initial: DailyHintBundle = {
  pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [],
};
const response = (token = 'successor') => ({
  hint: {
    hintType: DEFAULT_DAILY_HINT_CONFIG[0]!.hintType,
    hintLabel: DEFAULT_DAILY_HINT_CONFIG[0]!.displayLabel,
    hintValue: 'AUTHORIZED_HINT',
  },
  progressionToken: token,
});
const request = (onSuccess: ReturnType<typeof vi.fn>) => ({
  progressionToken: 'predecessor',
  hintBundle: initial,
  hintConfig: DEFAULT_DAILY_HINT_CONFIG,
  onSuccess,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('source-only official Daily on-demand hint request lifecycle', () => {
  it('applies one authorized response through the existing generation fence', async () => {
    const pending: boolean[] = [];
    const errors: Array<string | null> = [];
    const onSuccess = vi.fn();
    const post = vi.fn(async () => response());
    const client = createDailyOnDemandHintRequestClient({
      onPendingChange: value => pending.push(value),
      onErrorChange: value => errors.push(value),
    }, post);

    expect(await client.reveal(request(onSuccess))).toBe(true);
    expect(post).toHaveBeenCalledExactlyOnceWith('predecessor');
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      reveal: expect.objectContaining({ progressionToken: 'successor', revealedCount: 1 }),
      hintBundle: expect.objectContaining({ revealedCount: 1, checkpoints: [] }),
    }));
    expect(pending).toEqual([true, false]);
    expect(errors).toEqual([null]);
  });

  it('rejects a concurrent reveal while one is pending, without a second request', async () => {
    const slow = deferred<unknown>();
    const post = vi.fn(() => slow.promise);
    const onSuccess = vi.fn();
    const client = createDailyOnDemandHintRequestClient({
      onPendingChange: () => undefined,
      onErrorChange: () => undefined,
    }, post);

    const first = client.reveal(request(onSuccess));
    expect(await client.reveal(request(onSuccess))).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
    slow.resolve(response());
    expect(await first).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('discards stale sibling response after invalidation and accepts only replacement', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const post = vi.fn().mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const pending: boolean[] = [];
    const stale = vi.fn(), winner = vi.fn();
    const client = createDailyOnDemandHintRequestClient({
      onPendingChange: value => pending.push(value),
      onErrorChange: () => undefined,
    }, post);

    const oldRequest = client.reveal(request(stale));
    client.invalidate();
    const newRequest = client.reveal(request(winner));
    first.resolve(response('OLD_TOKEN'));
    await flush();
    expect(stale).not.toHaveBeenCalled();
    expect(winner).not.toHaveBeenCalled();
    second.resolve(response('NEW_TOKEN'));
    await Promise.all([oldRequest, newRequest]);
    expect(winner).toHaveBeenCalledWith(expect.objectContaining({
      reveal: expect.objectContaining({ progressionToken: 'NEW_TOKEN' }),
    }));
    expect(pending).toEqual([true, false, true, false]);
  });

  it('redacts malformed hint or transport errors and never commits invalid state', async () => {
    const onSuccess = vi.fn();
    const errors: Array<string | null> = [];
    const client = createDailyOnDemandHintRequestClient({
      onPendingChange: () => undefined,
      onErrorChange: value => errors.push(value),
    }, async () => ({ ...response(), extra: 'PRIVATE_FUTURE_HINT' }));

    expect(await client.reveal(request(onSuccess))).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(errors.at(-1)).toMatch(/next hint could not be loaded/i);
    expect(JSON.stringify(errors)).not.toContain('PRIVATE_FUTURE_HINT');

    const networkClient = createDailyOnDemandHintRequestClient({
      onPendingChange: () => undefined,
      onErrorChange: value => errors.push(value),
    }, async () => { throw new Error('PRIVATE_HINT_INTERNAL'); });
    await networkClient.reveal(request(onSuccess));
    expect(JSON.stringify(errors)).not.toContain('PRIVATE_HINT_INTERNAL');
  });
});
