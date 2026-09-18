'use client';

import {
  CLASSIC_DAILY_RULESET_VERSION,
  DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyCompletedAtBat,
  type DailyCompletedResultRulesetVersion,
  type DailyCompletedResultSubmission,
  type DailyPublicPuzzle,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';

const STORAGE_PREFIX = 'initial-baseball:daily-result-submission:v1';
const MARKER_VERSION = 1 as const;

type SubmissionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type MarkerStatus = 'pending' | 'submitted' | 'conflict' | 'rejected';

type SubmissionMarker = {
  version: typeof MARKER_VERSION;
  submissionId: string;
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: DailyCompletedResultRulesetVersion;
  status: MarkerStatus;
};

export type CompletedDailyResultSubmissionInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};

export type CompletedDailyResultSubmissionState =
  | MarkerStatus
  | 'unsupported'
  | 'unavailable';

type SubmissionRequest = (
  submission: DailyCompletedResultSubmission,
) => Promise<{ ok: boolean; status: number }>;

type CreateClientInput = {
  storage: SubmissionStorage | null;
  createSubmissionId: () => string | null;
  submitRequest: SubmissionRequest;
};

export function createDailyCompletedResultClient({
  storage,
  createSubmissionId,
  submitRequest,
}: CreateClientInput) {
  const inFlight = new Map<string, Promise<CompletedDailyResultSubmissionState>>();

  return {
    submitIfNeeded(input: CompletedDailyResultSubmissionInput) {
      if (!isSubmittableRuleset(input.rulesetVersion)) {
        return Promise.resolve<CompletedDailyResultSubmissionState>('unsupported');
      }
      if (storage === null) {
        return Promise.resolve<CompletedDailyResultSubmissionState>('unavailable');
      }

      const identity = {
        puzzleId: input.puzzle.id,
        puzzleDate: input.puzzle.puzzleDate,
        rulesetVersion: input.rulesetVersion,
      };
      const key = storageKey(identity);
      let marker = readMarker(storage, key, identity);

      if (marker === null) {
        const submissionId = createSubmissionId();
        if (submissionId === null || !isSubmissionId(submissionId)) {
          return Promise.resolve<CompletedDailyResultSubmissionState>('unavailable');
        }
        marker = { version: MARKER_VERSION, submissionId, ...identity, status: 'pending' };
        if (!writeMarker(storage, key, marker)) {
          return Promise.resolve<CompletedDailyResultSubmissionState>('unavailable');
        }
      }

      if (marker.status !== 'pending') {
        return Promise.resolve<CompletedDailyResultSubmissionState>(marker.status);
      }

      const active = inFlight.get(key);
      if (active !== undefined) return active;

      const request = submitPending(storage, key, identity, marker, input, submitRequest);
      inFlight.set(key, request);
      void request.finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
      return request;
    },

    clear(input: Pick<CompletedDailyResultSubmissionInput, 'puzzle' | 'rulesetVersion'>): void {
      if (storage === null || !isSubmittableRuleset(input.rulesetVersion)) return;
      const key = storageKey({
        puzzleId: input.puzzle.id,
        puzzleDate: input.puzzle.puzzleDate,
        rulesetVersion: input.rulesetVersion,
      });
      inFlight.delete(key);
      safelyRemove(storage, key);
    },
  };
}

async function submitPending(
  storage: SubmissionStorage,
  key: string,
  identity: Pick<SubmissionMarker, 'puzzleId' | 'puzzleDate' | 'rulesetVersion'>,
  marker: SubmissionMarker,
  input: CompletedDailyResultSubmissionInput,
  submitRequest: SubmissionRequest,
): Promise<CompletedDailyResultSubmissionState> {
  const submission: DailyCompletedResultSubmission = {
    schemaVersion: DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
    submissionId: marker.submissionId,
    puzzleId: input.puzzle.id,
    puzzleDate: input.puzzle.puzzleDate,
    puzzleNumber: input.puzzle.puzzleNumber,
    rulesetVersion: marker.rulesetVersion,
    completedAtBats: input.completedAtBats.map(atBat => ({ ...atBat })),
  };

  let response: { ok: boolean; status: number };
  try {
    response = await submitRequest(submission);
  } catch {
    return currentMarkerState(storage, key, identity, marker.submissionId);
  }

  const terminalStatus = response.ok
    ? 'submitted'
    : response.status === 409
      ? 'conflict'
      : response.status >= 400 && response.status < 500
        ? 'rejected'
        : null;

  if (terminalStatus === null) {
    return currentMarkerState(storage, key, identity, marker.submissionId);
  }

  const current = readMarker(storage, key, identity);
  if (current === null || current.submissionId !== marker.submissionId || current.status !== 'pending') {
    return current?.status ?? 'pending';
  }

  const next = { ...current, status: terminalStatus };
  return writeMarker(storage, key, next) ? terminalStatus : 'pending';
}

function currentMarkerState(
  storage: SubmissionStorage,
  key: string,
  identity: Pick<SubmissionMarker, 'puzzleId' | 'puzzleDate' | 'rulesetVersion'>,
  submissionId: string,
): CompletedDailyResultSubmissionState {
  const current = readMarker(storage, key, identity);
  if (current === null || current.submissionId !== submissionId) return current?.status ?? 'pending';
  return current.status;
}

function storageKey(identity: Pick<SubmissionMarker, 'puzzleId' | 'puzzleDate' | 'rulesetVersion'>): string {
  return [
    STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.puzzleId),
  ].join(':');
}

function readMarker(
  storage: SubmissionStorage,
  key: string,
  identity: Pick<SubmissionMarker, 'puzzleId' | 'puzzleDate' | 'rulesetVersion'>,
): SubmissionMarker | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value)
    || value.version !== MARKER_VERSION
    || !isSubmissionId(value.submissionId)
    || value.puzzleId !== identity.puzzleId
    || value.puzzleDate !== identity.puzzleDate
    || value.rulesetVersion !== identity.rulesetVersion
    || !isMarkerStatus(value.status)) {
    return null;
  }
  return value as SubmissionMarker;
}

function writeMarker(storage: SubmissionStorage, key: string, marker: SubmissionMarker): boolean {
  try {
    storage.setItem(key, JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}

function safelyRemove(storage: SubmissionStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Result bookkeeping must never block gameplay/reset.
  }
}

function isSubmittableRuleset(
  rulesetVersion: DailyRulesetVersion,
): rulesetVersion is DailyCompletedResultRulesetVersion {
  return rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
    || rulesetVersion === CLASSIC_DAILY_RULESET_VERSION;
}

function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isMarkerStatus(value: unknown): value is MarkerStatus {
  return value === 'pending'
    || value === 'submitted'
    || value === 'conflict'
    || value === 'rejected';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

let browserClient: ReturnType<typeof createDailyCompletedResultClient> | null = null;

function getBrowserClient() {
  browserClient ??= createDailyCompletedResultClient({
    storage: getBrowserStorage(),
    createSubmissionId: createBrowserSubmissionId,
    submitRequest: async (submission) => {
      const response = await fetch('/api/daily/results', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });
      return { ok: response.ok, status: response.status };
    },
  });
  return browserClient;
}

export function submitCompletedDailyResultIfNeeded(input: CompletedDailyResultSubmissionInput) {
  return getBrowserClient().submitIfNeeded(input);
}

export function clearCompletedDailyResultSubmission(
  input: Pick<CompletedDailyResultSubmissionInput, 'puzzle' | 'rulesetVersion'>,
): void {
  getBrowserClient().clear(input);
}

function createBrowserSubmissionId(): string | null {
  try {
    return globalThis.crypto?.randomUUID?.() ?? null;
  } catch {
    return null;
  }
}

function getBrowserStorage(): SubmissionStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
