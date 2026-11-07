import { DEFAULT_DAILY_HINT_CONFIG } from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyGameplayRequestController } from './dailyGameplayRequestController';
import { createDailyOnDemandHintRequestClient } from './dailyOnDemandHintRequestClient';
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

  it('routes a bound edition resolution without hitting the primary endpoint', async () => {
    const postJson = vi.fn(async () => buildResolutionResponse());
    const path = '/api/daily/editions/daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08/resolve';
    const client = createDailyGameplayResolutionClient({
      onPendingActionChange: () => undefined, onErrorChange: () => undefined,
    }, postJson, path);
    await client.resolveAtBat({ progressionToken: 'edition-token',
      action: { giveUp: true }, onSuccess: () => undefined });
    expect(postJson).toHaveBeenCalledWith(path, {
      progressionToken: 'edition-token', giveUp: true,
    });
    expect(postJson.mock.calls.flat().join(' ')).not.toContain('/api/daily/resolve');
  });

  it('prevents a guess from overtaking a pending authorized hint request', async () => {
    const shared = createDailyGameplayRequestController();
    const slow = deferred<unknown>();
    const revealPost = vi.fn(() => slow.promise);
    const resolvePost = vi.fn(async () => buildResolutionResponse());
    const reveal = createDailyOnDemandHintRequestClient({
      onPendingChange: () => undefined, onErrorChange: () => undefined,
    }, revealPost, shared);
    const resolution = createDailyGameplayResolutionClient({
      onPendingActionChange: () => undefined, onErrorChange: () => undefined,
    }, resolvePost, '/api/daily/editions/exact-id/resolve', shared);
    const hint = reveal.reveal({
      progressionToken: 'signed-before',
      hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
      hintConfig: DEFAULT_DAILY_HINT_CONFIG, onSuccess: () => undefined,
    });
    expect(await resolution.resolveAtBat({
      progressionToken: 'signed-before', action: { giveUp: true }, onSuccess: () => undefined,
    })).toBe(false);
    expect(resolvePost).not.toHaveBeenCalled();
    slow.resolve({
      hint: { hintType: 'main_decade',
        hintLabel: DEFAULT_DAILY_HINT_CONFIG[0]!.displayLabel, hintValue: 'AUTHORIZED_HINT' },
      progressionToken: 'signed-after',
    });
    await hint;
    expect(await resolution.resolveAtBat({
      progressionToken: 'signed-after', action: { giveUp: true }, onSuccess: () => undefined,
    })).toBe(true);
    expect(resolvePost).toHaveBeenCalledTimes(1);
  });

  it('prevents a hint request from overtaking a pending signed resolution', async () => {
    const shared = createDailyGameplayRequestController();
    const slow = deferred<DailyResolutionResponse>();
    const resolvePost = vi.fn(() => slow.promise);
    const revealPost = vi.fn(async () => ({}));
    const reveal = createDailyOnDemandHintRequestClient({
      onPendingChange: () => undefined, onErrorChange: () => undefined,
    }, revealPost, shared);
    const resolution = createDailyGameplayResolutionClient({
      onPendingActionChange: () => undefined, onErrorChange: () => undefined,
    }, resolvePost, '/api/daily/editions/exact-id/resolve', shared);
    const pending = resolution.resolveAtBat({
      progressionToken: 'signed-before', action: { giveUp: true }, onSuccess: () => undefined,
    });
    expect(await reveal.reveal({
      progressionToken: 'signed-before',
      hintBundle: { pitchNumber: 1, revealedCount: 0, hints: [], checkpoints: [] },
      hintConfig: DEFAULT_DAILY_HINT_CONFIG, onSuccess: () => undefined,
    })).toBe(false);
    expect(revealPost).not.toHaveBeenCalled();
    slow.resolve(buildResolutionResponse());
    await pending;
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
