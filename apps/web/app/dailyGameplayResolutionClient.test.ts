import { describe, expect, it, vi } from 'vitest';
import type { DailyResolutionResponse } from './dailyRuntimeContracts';
import { createDailyGameplayResolutionClient } from './dailyGameplayResolutionClient';

describe('daily gameplay resolution client', () => {
  it('posts a guess through the fenced resolve endpoint lifecycle', async () => {
    const pendingActions: Array<'guess' | 'give_up' | null> = [];
    const errors: Array<string | null> = ['old error'];
    const response = buildResolutionResponse();
    const postJson = vi.fn(async () => response);
    const onSuccess = vi.fn();
    const client = createDailyGameplayResolutionClient({
      onPendingActionChange: action => pendingActions.push(action),
      onErrorChange: message => errors.push(message),
    }, postJson);

    const accepted = await client.resolveAtBat({
      progressionToken: 'progression-1',
      action: { submittedPlayerId: 'player-1' },
      onSuccess,
    });

    expect(accepted).toBe(true);
    expect(postJson).toHaveBeenCalledWith('/api/daily/resolve', {
      progressionToken: 'progression-1',
      submittedPlayerId: 'player-1',
    });
    expect(pendingActions).toEqual(['guess', null]);
    expect(errors).toEqual(['old error', null]);
    expect(onSuccess).toHaveBeenCalledWith(response);
  });

  it('maps give up to the dedicated pending action', async () => {
    const pendingActions: Array<'guess' | 'give_up' | null> = [];
    const client = createDailyGameplayResolutionClient({
      onPendingActionChange: action => pendingActions.push(action),
      onErrorChange: () => undefined,
    }, async () => buildResolutionResponse());

    await client.resolveAtBat({
      progressionToken: 'progression-1',
      action: { giveUp: true },
      onSuccess: () => undefined,
    });

    expect(pendingActions).toEqual(['give_up', null]);
  });

  it('reports the shared request error and clears pending state on current failure', async () => {
    const pendingActions: Array<'guess' | 'give_up' | null> = [];
    const errors: Array<string | null> = [];
    const client = createDailyGameplayResolutionClient({
      onPendingActionChange: action => pendingActions.push(action),
      onErrorChange: message => errors.push(message),
    }, async () => {
      throw new Error('network failure');
    });

    await client.resolveAtBat({
      progressionToken: 'progression-1',
      action: { submittedPlayerId: 'player-1' },
      onSuccess: () => undefined,
    });

    expect(pendingActions).toEqual(['guess', null]);
    expect(errors).toEqual([
      null,
      'The Daily game could not complete that action. Please try again.',
    ]);
  });

  it('clears pending UI on invalidation and keeps the stale request inert beside a replacement', async () => {
    const first = deferred<DailyResolutionResponse>();
    const second = deferred<DailyResolutionResponse>();
    const postJson = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    let pendingAction: 'guess' | 'give_up' | null = null;
    const firstSuccess = vi.fn();
    const secondSuccess = vi.fn();
    const client = createDailyGameplayResolutionClient({
      onPendingActionChange: action => { pendingAction = action; },
      onErrorChange: () => undefined,
    }, postJson);

    void client.resolveAtBat({
      progressionToken: 'progression-1',
      action: { submittedPlayerId: 'player-1' },
      onSuccess: firstSuccess,
    });
    expect(pendingAction).toBe('guess');

    client.invalidate();
    expect(pendingAction).toBeNull();

    void client.resolveAtBat({
      progressionToken: 'progression-2',
      action: { giveUp: true },
      onSuccess: secondSuccess,
    });
    expect(pendingAction).toBe('give_up');

    first.resolve(buildResolutionResponse());
    await flushAsyncWork();
    expect(firstSuccess).not.toHaveBeenCalled();
    expect(pendingAction).toBe('give_up');

    second.resolve(buildResolutionResponse());
    await flushAsyncWork();
    expect(secondSuccess).toHaveBeenCalledOnce();
    expect(pendingAction).toBeNull();
  });

  it('supports StrictMode-style silent invalidation and reuse without reviving stale work', async () => {
    const first = deferred<DailyResolutionResponse>();
    const second = deferred<DailyResolutionResponse>();
    const postJson = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const pendingActions: Array<'guess' | 'give_up' | null> = [];
    const firstSuccess = vi.fn();
    const secondSuccess = vi.fn();
    const client = createDailyGameplayResolutionClient({
      onPendingActionChange: action => pendingActions.push(action),
      onErrorChange: () => undefined,
    }, postJson);

    void client.resolveAtBat({
      progressionToken: 'progression-1',
      action: { submittedPlayerId: 'player-1' },
      onSuccess: firstSuccess,
    });
    client.invalidateSilently();

    void client.resolveAtBat({
      progressionToken: 'progression-2',
      action: { submittedPlayerId: 'player-2' },
      onSuccess: secondSuccess,
    });

    first.resolve(buildResolutionResponse());
    await flushAsyncWork();
    expect(firstSuccess).not.toHaveBeenCalled();

    second.resolve(buildResolutionResponse());
    await flushAsyncWork();
    expect(secondSuccess).toHaveBeenCalledOnce();
    expect(pendingActions).toEqual(['guess', 'guess', null]);
  });
});

function buildResolutionResponse(): DailyResolutionResponse {
  return {
    result: {
      kind: 'incorrect',
      revealedCount: 0,
      strikeCount: 1,
      remainingStrikes: 2,
    },
    reveal: null,
    progressionToken: 'next-progression-token',
    hintBundle: {
      pitchNumber: 1,
      revealedCount: 0,
      hints: [
        { slot: 1, hintType: 'main_decade', hintLabel: 'Main decade played in', hintValue: '1990s' },
        { slot: 2, hintType: 'teams', hintLabel: 'Teams', hintValue: 'AAA' },
        { slot: 3, hintType: 'position', hintLabel: 'Position', hintValue: 'OF' },
        { slot: 4, hintType: 'stats', hintLabel: 'Stats', hintValue: 'Stats' },
      ],
      checkpoints: [1, 2, 3, 4].map(revealedCount => ({
        revealedCount: revealedCount as 1 | 2 | 3 | 4,
        progressionToken: `token-${revealedCount}`,
      })),
    },
  };
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

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
