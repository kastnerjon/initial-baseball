'use client';

import type { DailyAtBatAttemptIdentity } from './dailyAtBatAttemptJournal';
import {
  createBrowserDailyAtBatGameplayLifecycle,
  type DailyAtBatContributionSession,
} from './dailyAtBatGameplayLifecycle';
import {
  createBrowserDailyAtBatResultClient,
  type DailyAtBatOwnerDeliverySession,
} from './dailyAtBatResultClient';
import {
  canPersistCurrentDailyGameplay,
  type DailyGameplayAccess,
} from './dailyGameplayPersistenceAuthority';

type OwnerLifecycle = Pick<
  ReturnType<typeof createBrowserDailyAtBatGameplayLifecycle>,
  'resetContribution' | 'retireAfterGameplaySaveFailure' | 'retireAfterDeliveryFailure'
>;

type OwnerResultClient = Pick<
  ReturnType<typeof createBrowserDailyAtBatResultClient>,
  'freezeObservation'
>;

type OwnerRuntime = {
  identity: DailyAtBatAttemptIdentity;
  lifecycle: OwnerLifecycle;
  resultClient: OwnerResultClient;
};

type CompletionPolicy = {
  allowCreate: boolean;
  creationSubmissionId: string | null;
};

const DISABLED_COMPLETION_POLICY: CompletionPolicy = {
  allowCreate: false,
  creationSubmissionId: null,
};

export function createDailyGameplayPersistenceSession({
  onAccessChange,
  onContributionChange,
  onReadySessionKeyChange,
  onPersistenceSessionInvalidated,
}: {
  onAccessChange: (access: DailyGameplayAccess) => void;
  onContributionChange: (contribution: DailyAtBatContributionSession | null) => void;
  onReadySessionKeyChange: (sessionKey: string | null) => void;
  onPersistenceSessionInvalidated: () => void;
}) {
  let activeSessionKey: string | null = null;
  let readySessionKey: string | null = null;
  let access: DailyGameplayAccess = 'checking';
  let contribution: DailyAtBatContributionSession | null = null;
  let runtime: OwnerRuntime | null = null;
  let deliverySession: DailyAtBatOwnerDeliverySession | null = null;
  let completionPolicy: CompletionPolicy = { ...DISABLED_COMPLETION_POLICY };

  return {
    beginSession,
    releaseSession,
    isActiveSession,
    markReady,
    markNotReady,
    setAccess,
    setContribution,
    clearContribution,
    setCompletionPolicy,
    getCompletionPolicy: () => completionPolicy,
    configureOwnerRuntime,
    replaceDeliverySession,
    getContribution: () => contribution,
    getCommitRuntime,
    getMatchingDeliverySession,
    failCurrentGameplaySave,
    failCurrentContribution,
    resetContributionForCurrentAccess,
    canPersist,
  };

  function beginSession(sessionKey: string): void {
    activeSessionKey = sessionKey;
    readySessionKey = null;
    access = 'checking';
    replaceDeliverySession(null);
    runtime = null;
    contribution = null;
    completionPolicy = { ...DISABLED_COMPLETION_POLICY };
    onReadySessionKeyChange(null);
    onContributionChange(null);
  }

  function releaseSession(expectedSessionKey: string): void {
    if (activeSessionKey !== expectedSessionKey) return;
    activeSessionKey = null;
    readySessionKey = null;
    access = 'checking';
    onPersistenceSessionInvalidated();
    replaceDeliverySession(null);
    runtime = null;
  }

  function isActiveSession(sessionKey: string): boolean {
    return activeSessionKey === sessionKey;
  }

  function markReady(expectedSessionKey: string): void {
    if (activeSessionKey !== expectedSessionKey) return;
    readySessionKey = expectedSessionKey;
    onReadySessionKeyChange(expectedSessionKey);
  }

  function markNotReady(expectedSessionKey: string): void {
    if (activeSessionKey !== expectedSessionKey) return;
    readySessionKey = null;
    onReadySessionKeyChange(null);
  }

  function setAccess(next: DailyGameplayAccess): void {
    if (access === 'owner' && next !== 'owner') {
      onPersistenceSessionInvalidated();
    }
    access = next;
    onAccessChange(next);
  }

  function setContribution(next: DailyAtBatContributionSession): void {
    contribution = next;
    onContributionChange(next);
    completionPolicy = {
      allowCreate: next.allowCompletedResultCreate,
      creationSubmissionId: next.status === 'active' ? next.attemptId : null,
    };
  }

  function clearContribution(): void {
    contribution = null;
    onContributionChange(null);
  }

  function setCompletionPolicy(
    allowCreate: boolean,
    creationSubmissionId: string | null = null,
  ): void {
    completionPolicy = { allowCreate, creationSubmissionId };
  }

  function configureOwnerRuntime(next: OwnerRuntime): void {
    runtime = next;
  }

  function replaceDeliverySession(next: DailyAtBatOwnerDeliverySession | null): void {
    deliverySession?.dispose();
    deliverySession = next;
  }

  function getCommitRuntime() {
    return runtime === null
      ? null
      : {
          identity: runtime.identity,
          resultClient: runtime.resultClient,
        };
  }

  function getMatchingDeliverySession(
    expectedContribution: DailyAtBatContributionSession | null,
  ): DailyAtBatOwnerDeliverySession | null {
    return sameOwnerDeliverySession(deliverySession, expectedContribution)
      ? deliverySession
      : null;
  }

  function failCurrentGameplaySave(
    expectedContribution: DailyAtBatContributionSession | null,
  ): void {
    if (!sameActiveContribution(contribution, expectedContribution) || runtime === null) return;
    setContribution(runtime.lifecycle.retireAfterGameplaySaveFailure(contribution));
  }

  function failCurrentContribution(
    expectedContribution: DailyAtBatContributionSession | null,
  ): void {
    if (access !== 'owner'
      || !sameActiveContribution(contribution, expectedContribution)
      || runtime === null) return;
    setContribution(runtime.lifecycle.retireAfterDeliveryFailure(contribution));
  }

  function resetContributionForCurrentAccess(): void {
    if (access === 'owner') {
      if (runtime !== null && contribution !== null) {
        setContribution(runtime.lifecycle.resetContribution(contribution));
      }
      return;
    }
    completionPolicy = { allowCreate: true, creationSubmissionId: null };
  }

  function canPersist({
    renderAccess,
    renderSessionKey,
    renderReadySessionKey,
  }: {
    renderAccess: DailyGameplayAccess;
    renderSessionKey: string;
    renderReadySessionKey: string | null;
  }): boolean {
    return canPersistCurrentDailyGameplay({
      renderAccess,
      currentAccess: access,
      renderSessionKey,
      currentSessionKey: activeSessionKey,
      renderReadySessionKey,
      currentReadySessionKey: readySessionKey,
    });
  }
}

function sameOwnerDeliverySession(
  delivery: DailyAtBatOwnerDeliverySession | null,
  contribution: DailyAtBatContributionSession | null,
): delivery is DailyAtBatOwnerDeliverySession {
  return delivery !== null
    && contribution?.status === 'active'
    && delivery.attemptId === contribution.attemptId
    && delivery.generation === contribution.generation;
}

function sameActiveContribution(
  current: DailyAtBatContributionSession | null,
  expected: DailyAtBatContributionSession | null,
): current is Extract<DailyAtBatContributionSession, { status: 'active' }> {
  return current?.status === 'active'
    && expected?.status === 'active'
    && current.attemptId === expected.attemptId
    && current.generation === expected.generation;
}
