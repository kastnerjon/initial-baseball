import { describe, expect, it, vi } from 'vitest';
import {
  attemptOfficialDailyAnonymousFirstOpen,
  OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME,
  type OfficialDailyExclusiveLockManager,
} from './officialDailyAnonymousFirstOpen';

function exclusiveLocks() {
  let previous: Promise<void> = Promise.resolve();
  const seen: string[] = [];
  const locks: OfficialDailyExclusiveLockManager = {
    async request<T>(
      name: string,
      options: { mode: 'exclusive'; signal: AbortSignal },
      callback: (lock: object | null) => Promise<T>,
    ): Promise<T> {
      expect(options.mode).toBe('exclusive');
      seen.push(name);
      const before = previous;
      let release!: () => void;
      previous = new Promise<void>(resolve => { release = resolve; });
      await before;
      try {
        if (options.signal.aborted) throw new Error('aborted');
        return await callback({ name });
      } finally {
        release();
      }
    },
  };
  return { locks, seen };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(finish => { resolve = finish; });
  return { promise, resolve };
}
function steps(locks: OfficialDailyExclusiveLockManager | null) {
  const signal = new AbortController().signal;
  const confirmServerCookie = vi.fn(async () => true);
  const initializeServerCookie = vi.fn(async (): Promise<void> => undefined);
  const requestServerStart = vi.fn(async () => ({ attempt: 'server-reserved' }));
  return { locks, signal, confirmServerCookie, initializeServerCookie, requestServerStart };
}

describe('source-only official Daily anonymous first-open coordination', () => {
  it('denies competitive start when Web Locks are unavailable', async () => {
    const input = steps(null);
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'practice_only', reason: 'locking_unavailable',
    });
    expect(input.confirmServerCookie).not.toHaveBeenCalled();
    expect(input.initializeServerCookie).not.toHaveBeenCalled();
    expect(input.requestServerStart).not.toHaveBeenCalled();
  });

  it('uses a confirmed existing cookie without creating another credential', async () => {
    const { locks, seen } = exclusiveLocks();
    const input = steps(locks);
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'start_response', response: { attempt: 'server-reserved' },
    });
    expect(input.confirmServerCookie).toHaveBeenCalledTimes(1);
    expect(input.initializeServerCookie).not.toHaveBeenCalled();
    expect(input.requestServerStart).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME]);
  });

  it('serializes two initially cookie-less tabs across one global cookie handshake', async () => {
    const { locks, seen } = exclusiveLocks();
    const gate = deferred();
    let present = false;
    const initializeServerCookie = vi.fn(async () => {
      await gate.promise;
      present = true;
    });
    const confirmServerCookie = vi.fn(async () => present);
    const firstStart = vi.fn(async () => ({ edition: 'modern' }));
    const secondStart = vi.fn(async () => ({ edition: 'retro' }));
    const first = attemptOfficialDailyAnonymousFirstOpen({
      locks, signal: new AbortController().signal, confirmServerCookie,
      initializeServerCookie, requestServerStart: firstStart,
    });
    const second = attemptOfficialDailyAnonymousFirstOpen({
      locks, signal: new AbortController().signal, confirmServerCookie,
      initializeServerCookie, requestServerStart: secondStart,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(initializeServerCookie).toHaveBeenCalledTimes(1);
    expect(firstStart).not.toHaveBeenCalled();
    expect(secondStart).not.toHaveBeenCalled();
    gate.resolve();
    expect(await Promise.all([first, second])).toEqual([
      { status: 'start_response', response: { edition: 'modern' } },
      { status: 'start_response', response: { edition: 'retro' } },
    ]);
    expect(initializeServerCookie).toHaveBeenCalledTimes(1);
    expect(confirmServerCookie).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME, OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME]);
  });

  it('never starts live if a cookie cannot be confirmed in a separate readback', async () => {
    const { locks } = exclusiveLocks();
    const input = steps(locks);
    input.confirmServerCookie.mockResolvedValue(false);
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'practice_only', reason: 'credential_unconfirmed',
    });
    expect(input.initializeServerCookie).toHaveBeenCalledTimes(1);
    expect(input.confirmServerCookie).toHaveBeenCalledTimes(2);
    expect(input.requestServerStart).not.toHaveBeenCalled();
  });

  it('fails closed on handshake provider errors before server start', async () => {
    const { locks } = exclusiveLocks();
    const input = steps(locks);
    input.confirmServerCookie.mockRejectedValue(new Error('PRIVATE_COOKIE_ERROR'));
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'practice_only', reason: 'handshake_unavailable',
    });
    expect(input.requestServerStart).not.toHaveBeenCalled();
  });

  it('does not start after aborting during a delayed credential initialization', async () => {
    const { locks } = exclusiveLocks();
    const controller = new AbortController();
    const gate = deferred();
    const input = steps(locks);
    input.confirmServerCookie.mockResolvedValue(false);
    input.initializeServerCookie.mockImplementation(async () => gate.promise);
    const task = attemptOfficialDailyAnonymousFirstOpen({ ...input, signal: controller.signal });
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    gate.resolve();
    expect(await task).toEqual({ status: 'practice_only', reason: 'aborted' });
    expect(input.requestServerStart).not.toHaveBeenCalled();
  });

  it('keeps the origin-wide lock held until the first start response settles', async () => {
    const { locks } = exclusiveLocks();
    const pendingStart = deferred();
    const startEntered = deferred();
    const firstStart = vi.fn(async () => {
      startEntered.resolve();
      await pendingStart.promise;
      return { edition: 'modern' };
    });
    const secondConfirm = vi.fn(async () => true);
    const secondStart = vi.fn(async () => ({ edition: 'retro' }));
    const first = attemptOfficialDailyAnonymousFirstOpen({
      locks, signal: new AbortController().signal,
      confirmServerCookie: vi.fn(async () => true),
      initializeServerCookie: vi.fn(async (): Promise<void> => undefined),
      requestServerStart: firstStart,
    });
    await startEntered.promise;
    const second = attemptOfficialDailyAnonymousFirstOpen({
      locks, signal: new AbortController().signal,
      confirmServerCookie: secondConfirm,
      initializeServerCookie: vi.fn(async (): Promise<void> => undefined),
      requestServerStart: secondStart,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(secondConfirm).not.toHaveBeenCalled();
    expect(secondStart).not.toHaveBeenCalled();
    pendingStart.resolve();
    expect(await Promise.all([first, second])).toEqual([
      { status: 'start_response', response: { edition: 'modern' } },
      { status: 'start_response', response: { edition: 'retro' } },
    ]);
    expect(secondConfirm).toHaveBeenCalledTimes(1);
    expect(secondStart).toHaveBeenCalledTimes(1);
  });

  it('marks a lost first-start response as requiring reconciliation, not practice', async () => {
    const { locks } = exclusiveLocks();
    const input = steps(locks);
    input.requestServerStart.mockRejectedValue(new Error('PRIVATE_POST_COMMIT_FAILURE'));
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'reconciliation_required',
    });
    expect(input.initializeServerCookie).not.toHaveBeenCalled();
  });

  it('requires reconciliation after navigation aborts an in-flight server start', async () => {
    const { locks } = exclusiveLocks();
    const controller = new AbortController();
    const gate = deferred();
    const input = steps(locks);
    input.requestServerStart.mockImplementation(async () => {
      await gate.promise;
      return { attempt: 'server-reserved' };
    });
    const task = attemptOfficialDailyAnonymousFirstOpen({ ...input, signal: controller.signal });
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
    expect(input.requestServerStart).toHaveBeenCalledTimes(1);
    controller.abort();
    gate.resolve();
    expect(await task).toEqual({ status: 'reconciliation_required' });
  });

  it('reconciles if the lock layer fails after a possible successful server reservation', async () => {
    const input = steps({
      request: async <T>(_name: string, _options: { mode: 'exclusive'; signal: AbortSignal },
        callback: (lock: object | null) => Promise<T>): Promise<T> => {
        await callback({ name: OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME });
        throw new Error('PRIVATE_LOCK_RELEASE_FAILURE');
      },
    });
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'reconciliation_required',
    });
    expect(input.requestServerStart).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a lock provider rejects or gives no actual exclusive lock', async () => {
    const input = steps({
      request: async <T>(_name: string, _options: { mode: 'exclusive'; signal: AbortSignal },
        callback: (lock: object | null) => Promise<T>) => callback(null),
    });
    expect(await attemptOfficialDailyAnonymousFirstOpen(input)).toEqual({
      status: 'practice_only', reason: 'locking_unavailable',
    });
    expect(input.requestServerStart).not.toHaveBeenCalled();
  });
});
