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

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Status = 'pending' | 'submitted' | 'conflict' | 'rejected';
type Stored = { version: 1; status: Status; submission: DailyCompletedResultSubmission };
type Identity = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: DailyCompletedResultRulesetVersion;
};
type ReadResult = Stored | 'missing' | 'invalid';

export type CompletedDailyResultSubmissionInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};

export type CompletedDailyResultSubmissionState =
  | Status
  | 'not_started'
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

  async function deliver(
    key: string,
    record: Stored,
  ): Promise<CompletedDailyResultSubmissionState> {
    let response: { ok: boolean; status: number };
    try {
      response = await submitRequest(cloneSubmission(record.submission));
    } catch {
      return 'pending';
    }

    const next = classify(response);
    if (next === 'pending') return 'pending';

    const current = readByKey(storage!, key);
    if (typeof current === 'string') return 'pending';
    if (current.submission.submissionId !== record.submission.submissionId) {
      return current.status;
    }
    if (current.status !== 'pending') return current.status;
    return write(storage!, key, { ...current, status: next }) ? next : 'pending';
  }

  function submitIfNeeded(
    input: CompletedDailyResultSubmissionInput,
    options: { allowCreate: boolean },
  ): Promise<CompletedDailyResultSubmissionState> {
    if (!isSupported(input.rulesetVersion)) return Promise.resolve('unsupported');
    if (storage === null) return Promise.resolve('unavailable');

    const identity: Identity = {
      puzzleId: input.puzzle.id,
      puzzleDate: input.puzzle.puzzleDate,
      puzzleNumber: input.puzzle.puzzleNumber,
      rulesetVersion: input.rulesetVersion,
    };
    const key = markerKey(identity);
    const existing = read(storage, key, identity);
    if (existing === 'invalid') return Promise.resolve('unavailable');

    let record = existing === 'missing' ? null : existing;
    if (record === null) {
      if (!options.allowCreate) return Promise.resolve('not_started');
      const submissionId = createSubmissionId();
      if (!validId(submissionId)) return Promise.resolve('unavailable');
      record = {
        version: 1,
        status: 'pending',
        submission: {
          schemaVersion: DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
          submissionId,
          puzzleId: identity.puzzleId,
          puzzleDate: identity.puzzleDate,
          puzzleNumber: identity.puzzleNumber,
          rulesetVersion: identity.rulesetVersion,
          completedAtBats: input.completedAtBats.map(atBat => ({ ...atBat })),
        },
      };
      if (!write(storage, key, record)) return Promise.resolve('unavailable');
    }

    if (record.status !== 'pending') return Promise.resolve(record.status);
    const active = inFlight.get(key);
    if (active !== undefined) return active;

    const request = deliver(key, record);
    inFlight.set(key, request);
    void request.finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
    return request;
  }

  return { submitIfNeeded };
}

function classify(response: { ok: boolean; status: number }): Status {
  if (response.ok) return 'submitted';
  if (response.status === 409) return 'conflict';
  if (response.status === 408
    || response.status === 425
    || response.status === 429
    || response.status >= 500) return 'pending';
  return response.status >= 400 && response.status < 500 ? 'rejected' : 'pending';
}

function markerKey(identity: Omit<Identity, 'puzzleNumber'>): string {
  return [
    STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.puzzleId),
  ].join(':');
}

function read(
  storage: StorageLike,
  key: string,
  identity: Identity,
): ReadResult {
  const parsed = readByKey(storage, key);
  if (typeof parsed === 'string') return parsed;
  const submission = parsed.submission;
  return submission.puzzleId === identity.puzzleId
    && submission.puzzleDate === identity.puzzleDate
    && submission.puzzleNumber === identity.puzzleNumber
    && submission.rulesetVersion === identity.rulesetVersion
    ? parsed
    : 'invalid';
}

function readByKey(storage: StorageLike, key: string): ReadResult {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return 'missing';
    const value = JSON.parse(raw) as unknown;
    return isStored(value) ? value : 'invalid';
  } catch {
    return 'invalid';
  }
}

function write(storage: StorageLike, key: string, record: Stored): boolean {
  try {
    storage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function isStored(value: unknown): value is Stored {
  if (!isRecord(value)
    || value.version !== 1
    || !isStatus(value.status)
    || !isRecord(value.submission)) return false;
  const submission = value.submission;
  return submission.schemaVersion === DAILY_COMPLETED_RESULT_SCHEMA_VERSION
    && validId(submission.submissionId)
    && typeof submission.puzzleId === 'string'
    && submission.puzzleId.length > 0
    && typeof submission.puzzleDate === 'string'
    && Number.isInteger(submission.puzzleNumber)
    && isSupported(submission.rulesetVersion)
    && Array.isArray(submission.completedAtBats);
}

function cloneSubmission(submission: DailyCompletedResultSubmission): DailyCompletedResultSubmission {
  return {
    ...submission,
    completedAtBats: submission.completedAtBats.map(atBat => ({ ...atBat })),
  };
}

function isSupported(
  rulesetVersion: unknown,
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

export function submitCompletedDailyResultIfNeeded(
  input: CompletedDailyResultSubmissionInput,
  options: { allowCreate: boolean },
) {
  return getBrowserClient().submitIfNeeded(input, options);
}

function browserStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
