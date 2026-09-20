import { describe, expect, it } from 'vitest';
import type { DailyAtBatContributionSession } from './dailyAtBatGameplayLifecycle';
import type { DailyAtBatOwnerDeliverySession } from './dailyAtBatResultClient';
import { createDailyGameplayPersistenceSession } from './dailyGameplayPersistenceSession';

const IDENTITY = {
  id: 'daily-2026-09-20-editorial-v1',
  puzzleDate: '2026-09-20',
  puzzleNumber: 147,
  rulesetVersion: 'points-v3',
} as const;

function active(attemptId: string, generation: number): DailyAtBatContributionSession {
  return {
    status: 'active',
    attemptId,
    generation,
    allowCompletedResultCreate: true,
  };
}

function createHarness({
  resetContribution = (value: DailyAtBatContributionSession) => value,
  retireAfterGameplaySaveFailure = () => ({
    status: 'inactive' as const,
    reason: 'save_failure' as const,
    allowCompletedResultCreate: false,
  }),
  retireAfterDeliveryFailure = () => ({
    status: 'inactive' as const,
    reason: 'delivery_failure' as const,
    allowCompletedResultCreate: false,
  }),
}: {
  resetContribution?: (value: DailyAtBatContributionSession) => DailyAtBatContributionSession;
  retireAfterGameplaySaveFailure?: (
    value: DailyAtBatContributionSession,
  ) => DailyAtBatContributionSession;
  retireAfterDeliveryFailure?: (
    value: DailyAtBatContributionSession,
  ) => DailyAtBatContributionSession;
} = {}) {
  const accesses: string[] = [];
  const contributions: Array<DailyAtBatContributionSession | null> = [];
  const readyKeys: Array<string | null> = [];
  let invalidations = 0;
  const lifecycle = {
    resetContribution,
    retireAfterGameplaySaveFailure,
    retireAfterDeliveryFailure,
  };
  const resultClient = {
    freezeObservation: () => 'created' as const,
  };
  const session = createDailyGameplayPersistenceSession({
    onAccessChange: value => accesses.push(value),
    onContributionChange: value => contributions.push(value),
    onReadySessionKeyChange: value => readyKeys.push(value),
    onPersistenceSessionInvalidated: () => { invalidations += 1; },
  });

  return {
    session,
    lifecycle,
    resultClient,
    accesses,
    contributions,
    readyKeys,
    invalidations: () => invalidations,
  };
}

describe('Daily gameplay persistence session', () => {
  it('requires the exact live session, access, and readiness before persistence', () => {
    const { session } = createHarness();
    session.beginSession('session-a');
    session.setAccess('owner');
    session.markReady('session-a');

    expect(session.canPersist({
      renderAccess: 'owner',
      renderSessionKey: 'session-a',
      renderReadySessionKey: 'session-a',
    })).toBe(true);
    expect(session.canPersist({
      renderAccess: 'owner',
      renderSessionKey: 'session-b',
      renderReadySessionKey: 'session-a',
    })).toBe(false);

    session.markNotReady('session-a');
    expect(session.canPersist({
      renderAccess: 'owner',
      renderSessionKey: 'session-a',
      renderReadySessionKey: 'session-a',
    })).toBe(false);
  });

  it('invalidates gameplay requests when owner authority is lost and on session release', () => {
    const harness = createHarness();
    harness.session.beginSession('session-a');
    harness.session.setAccess('owner');
    expect(harness.invalidations()).toBe(0);

    harness.session.setAccess('follower');
    expect(harness.invalidations()).toBe(1);

    harness.session.releaseSession('session-a');
    expect(harness.invalidations()).toBe(2);
    expect(harness.session.isActiveSession('session-a')).toBe(false);
  });

  it('disposes replaced delivery authority and matches delivery to the exact contribution lifetime', () => {
    const { session, lifecycle, resultClient } = createHarness();
    session.beginSession('session-a');
    session.configureOwnerRuntime({ identity: IDENTITY, lifecycle, resultClient });
    const contribution = active('attempt-a', 2);
    session.setContribution(contribution);

    let disposed = 0;
    const delivery: DailyAtBatOwnerDeliverySession = {
      attemptId: 'attempt-a',
      generation: 2,
      deliverObservation: async () => 'submitted',
      retryPending: async () => [],
      dispose: () => { disposed += 1; },
    };
    session.replaceDeliverySession(delivery);
    expect(session.getMatchingDeliverySession(contribution)).toBe(delivery);

    session.setContribution(active('attempt-a', 3));
    expect(session.getMatchingDeliverySession(session.getContribution())).toBeNull();

    session.replaceDeliverySession(null);
    expect(disposed).toBe(1);
  });

  it('ignores a stale failure callback instead of retiring a newer contribution', () => {
    let retireCalls = 0;
    const harness = createHarness({
      retireAfterDeliveryFailure: () => {
        retireCalls += 1;
        return {
          status: 'inactive',
          reason: 'delivery_failure',
          allowCompletedResultCreate: false,
        };
      },
    });
    harness.session.beginSession('session-a');
    harness.session.configureOwnerRuntime({
      identity: IDENTITY,
      lifecycle: harness.lifecycle,
      resultClient: harness.resultClient,
    });
    harness.session.setAccess('owner');
    const stale = active('attempt-a', 1);
    const current = active('attempt-a', 2);
    harness.session.setContribution(current);

    harness.session.failCurrentContribution(stale);
    expect(retireCalls).toBe(0);
    expect(harness.session.getContribution()).toEqual(current);

    harness.session.failCurrentContribution(current);
    expect(retireCalls).toBe(1);
    expect(harness.session.getContribution()).toMatchObject({
      status: 'inactive',
      reason: 'delivery_failure',
    });
  });

  it('ignores a stale gameplay-save failure callback too', () => {
    let retireCalls = 0;
    const harness = createHarness({
      retireAfterGameplaySaveFailure: () => {
        retireCalls += 1;
        return {
          status: 'inactive',
          reason: 'save_failure',
          allowCompletedResultCreate: false,
        };
      },
    });
    harness.session.beginSession('session-a');
    harness.session.configureOwnerRuntime({
      identity: IDENTITY,
      lifecycle: harness.lifecycle,
      resultClient: harness.resultClient,
    });
    const stale = active('attempt-a', 1);
    const current = active('attempt-a', 2);
    harness.session.setContribution(current);

    harness.session.failCurrentGameplaySave(stale);
    expect(retireCalls).toBe(0);
    expect(harness.session.getContribution()).toEqual(current);

    harness.session.failCurrentGameplaySave(current);
    expect(retireCalls).toBe(1);
    expect(harness.session.getContribution()).toMatchObject({
      status: 'inactive',
      reason: 'save_failure',
    });
  });

  it('keeps completed-result creation identity tied to the active contribution', () => {
    const { session, lifecycle, resultClient } = createHarness();
    session.beginSession('session-a');
    session.configureOwnerRuntime({ identity: IDENTITY, lifecycle, resultClient });
    session.setAccess('owner');
    session.setContribution(active('attempt-a', 4));

    expect(session.getCompletionPolicy()).toEqual({
      allowCreate: true,
      creationSubmissionId: 'attempt-a',
    });

    session.setAccess('compatibility');
    session.resetContributionForCurrentAccess();
    expect(session.getCompletionPolicy()).toEqual({
      allowCreate: true,
      creationSubmissionId: null,
    });
  });
});
