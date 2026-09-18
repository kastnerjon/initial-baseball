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

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Status = 'pending' | 'submitted' | 'conflict' | 'rejected';
type Identity = {
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: DailyCompletedResultRulesetVersion;
};
type Marker = Identity & {
  version: 1;
  submissionId: string;
  status: Status;
};

export type CompletedDailyResultSubmissionInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};

export type CompletedDailyResultSubmissionState =
  | Status
  | 'unsupported'
  | 'unavailable';

type RequestFn = (
  submission: DailyCompletedResultSubmission,
) => Promise<{ ok: boolean; status: number }>;

export function createDailyCompletedResultClient({
  storage,
  createSubmissionId,
  submitRequest,
}: {
  storage: StorageLike | null;
  createSubmissionId: () => string | null;
  submitRequest: RequestFn;
}) {
  const inFlight = new Map<string, Promise<CompletedDailyResultSubmissionState>>();

  function submitIfNeeded(
    input: CompletedDailyResultSubmissionInput,
  ): Promise<CompletedDailyResultSubmissionState> {
    if (!isSupported(input.rulesetVersion)) return Promise.resolve('unsupported');
    if (storage === null) return Promise.resolve('unavailable');

    const identity: Identity = {
      puzzleId: input.puzzle.id,
      puzzleDate: input.puzzle.puzzleDate,
      rulesetVersion: input.rulesetVersion,
    };
    const key = markerKey(identity);
    let marker = readMarker(storage, key, identity);

    if (marker === null) {
      const submissionId = createSubmissionId();
      if (!validId(submissionId)) return Promise.resolve('unavailable');
      marker = { version: 1, submissionId, ...identity, status: 'pending' };
      if (!writeMarker(storage, key, marker)) return Promise.resolve('unavailable');
    }
    if (marker.status !== 'pending') return Promise.resolve(marker.status);

    const active = inFlight.get(key);
    if (active !== undefined) return active;

    const request = submit(marker, key, identity, input);
    inFlight.set(key, request);
    void request.finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
    return request;
  }

  async function submit(
    marker: Marker,
    key: string,
    identity: Identity,
    input: CompletedDailyResultSubmissionInput,
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
      return currentState(storage!, key, identity, marker.submissionId);
    }

    const terminal: Exclude<Status, 'pending'> | null = response.ok
      ? 'submitted'
      : response.status === 409
        ? 'conflict'
        : response.status >= 400 && response.status < 500
          ? 'rejected'
          : null;
    if (terminal === null) return currentState(storage!, key, identity, marker.submissionId);

    const current = readMarker(storage!, key, identity);
    if (current?.submissionId !== marker.submissionId || current.status !== 'pending') {
      return current?.status ?? 'pending';
    }
    return writeMarker(storage!, key, { ...current, status: terminal })
      ? terminal
      : 'pending';
  }

  function clear(
    input: Pick<CompletedDailyResultSubmissionInput, 'puzzle' | 'rulesetVersion'>,
  ): void {
    if (storage === null || !isSupported(input.rulesetVersion)) return;
    const identity: Identity = {
      puzzleId: input.puzzle.id,
      puzzleDate: input.puzzle.puzzleDate,
      rulesetVersion: input.rulesetVersion,
    };
    const key = markerKey(identity);
    inFlight.delete(key);
    try { storage.removeItem(key); } catch { /* never block reset */ }
  }

  return { submitIfNeeded, clear };
}

function currentState(
  storage: StorageLike,
  key: string,
  identity: Identity,
  submissionId: string,
): CompletedDailyResultSubmissionState {
  const current = readMarker(storage, key, identity);
  return current?.submissionId === submissionId ? current.status : current?.status ?? 'pending';
}

function markerKey(identity: Identity): string {
  return [
    STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.puzzleId),
  ].join(':');
}

function readMarker(storage: StorageLike, key: string, identity: Identity): Marker | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
      || value.version !== 1
      || !validId(value.submissionId)
      || value.puzzleId !== identity.puzzleId
      || value.puzzleDate !== identity.puzzleDate
      || value.rulesetVersion !== identity.rulesetVersion
      || !isStatus(value.status)) return null;
    return value as Marker;
  } catch {
    return null;
  }
}

function writeMarker(storage: StorageLike, key: string, marker: Marker): boolean {
  try {
    storage.setItem(key, JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}

function isSupported(
  rulesetVersion: DailyRulesetVersion,
): rulesetVersion is DailyCompletedResultRulesetVersion {
  return rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
    || rulesetVersion === CLASSIC_DAILY_RULESET_VERSION;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isStatus(value: unknown): value is Status {
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
    storage: browserStorage(),
    createSubmissionId: () => {
      try { return globalThis.crypto?.randomUUID?.() ?? null; } catch { return null; }
    },
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

function browserStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
