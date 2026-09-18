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
const RECORD_VERSION = 1 as const;

type SubmissionStorage = Pick<Storage, 'getItem' | 'setItem'>;
type TerminalStatus = 'submitted' | 'conflict' | 'rejected';
type RecordStatus = 'pending' | TerminalStatus;

type SubmissionRecord = {
  version: typeof RECORD_VERSION;
  status: RecordStatus;
  submission: DailyCompletedResultSubmission;
};

type StoredRecordRead =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'valid'; record: SubmissionRecord };

export type CompletedDailyResultSubmissionInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};

export type CompletedDailyResultSubmissionState =
  | RecordStatus
  | 'not_started'
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
    async submitIfNeeded(
      input: CompletedDailyResultSubmissionInput,
      options: { allowCreate: boolean },
    ): Promise<CompletedDailyResultSubmissionState> {
      if (!isSubmittableRuleset(input.rulesetVersion)) return 'unsupported';
      if (storage === null) return 'unavailable';

      const identity = {
        puzzleId: input.puzzle.id,
        puzzleDate: input.puzzle.puzzleDate,
        puzzleNumber: input.puzzle.puzzleNumber,
        rulesetVersion: input.rulesetVersion,
      };
      const key = storageKey(identity);
      const existing = readRecord(storage, key, identity);
      if (existing.kind === 'invalid') return 'unavailable';

      let record: SubmissionRecord;
      if (existing.kind === 'missing') {
        if (!options.allowCreate) return 'not_started';

        const submissionId = createSubmissionId();
        if (submissionId === null || !isSubmissionId(submissionId)) return 'unavailable';

        record = {
          version: RECORD_VERSION,
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
        if (!writeRecord(storage, key, record)) return 'unavailable';
      } else {
        record = existing.record;
      }

      if (record.status !== 'pending') return record.status;

      const active = inFlight.get(key);
      if (active !== undefined) return active;

      const request = deliverPendingRecord(storage, key, record, submitRequest)
        .finally(() => {
          if (inFlight.get(key) === request) inFlight.delete(key);
        });
      inFlight.set(key, request);
      return request;
    },
  };
}

export function submitCompletedDailyResultIfNeeded(
  input: CompletedDailyResultSubmissionInput,
  options: { allowCreate: boolean },
): Promise<CompletedDailyResultSubmissionState> {
  return getBrowserClient().submitIfNeeded(input, options);
}

async function deliverPendingRecord(
  storage: SubmissionStorage,
  key: string,
  record: SubmissionRecord,
  submitRequest: SubmissionRequest,
): Promise<CompletedDailyResultSubmissionState> {
  let response: { ok: boolean; status: number };
  try {
    response = await submitRequest(cloneSubmission(record.submission));
  } catch {
    return 'pending';
  }

  const nextStatus = classifyResponse(response);
  if (nextStatus === 'pending') return 'pending';

  return persistTerminalStatusIfCurrent(
    storage,
    key,
    record.submission.submissionId,
    nextStatus,
  );
}

function classifyResponse(response: { ok: boolean; status: number }): RecordStatus {
  if (response.ok) return 'submitted';
  if (response.status === 409) return 'conflict';
  if (response.status === 408
    || response.status === 425
    || response.status === 429
    || response.status >= 500) {
    return 'pending';
  }
  return response.status >= 400 && response.status < 500 ? 'rejected' : 'pending';
}

function persistTerminalStatusIfCurrent(
  storage: SubmissionStorage,
  key: string,
  submissionId: string,
  status: TerminalStatus,
): CompletedDailyResultSubmissionState {
  const current = readRecordByKey(storage, key);
  if (current.kind !== 'valid') return 'pending';
  if (current.record.submission.submissionId !== submissionId) {
    return current.record.status;
  }
  if (current.record.status !== 'pending') return current.record.status;

  const next: SubmissionRecord = { ...current.record, status };
  return writeRecord(storage, key, next) ? status : 'pending';
}

function storageKey(identity: {
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: DailyCompletedResultRulesetVersion;
}): string {
  return [
    STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.puzzleId),
  ].join(':');
}

function readRecord(
  storage: SubmissionStorage,
  key: string,
  identity: {
    puzzleId: string;
    puzzleDate: string;
    puzzleNumber: number;
    rulesetVersion: DailyCompletedResultRulesetVersion;
  },
): StoredRecordRead {
  const parsed = readRecordByKey(storage, key);
  if (parsed.kind !== 'valid') return parsed;

  const submission = parsed.record.submission;
  if (submission.puzzleId !== identity.puzzleId
    || submission.puzzleDate !== identity.puzzleDate
    || submission.puzzleNumber !== identity.puzzleNumber
    || submission.rulesetVersion !== identity.rulesetVersion) {
    return { kind: 'invalid' };
  }

  return parsed;
}

function readRecordByKey(storage: SubmissionStorage, key: string): StoredRecordRead {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { kind: 'invalid' };
  }
  if (raw === null) return { kind: 'missing' };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: 'invalid' };
  }

  if (!isRecord(value)
    || value.version !== RECORD_VERSION
    || !isRecordStatus(value.status)
    || !isStoredSubmission(value.submission)) {
    return { kind: 'invalid' };
  }

  return { kind: 'valid', record: value as SubmissionRecord };
}

function writeRecord(storage: SubmissionStorage, key: string, record: SubmissionRecord): boolean {
  try {
    storage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function isStoredSubmission(value: unknown): value is DailyCompletedResultSubmission {
  if (!isRecord(value)
    || value.schemaVersion !== DAILY_COMPLETED_RESULT_SCHEMA_VERSION
    || !isSubmissionId(value.submissionId)
    || typeof value.puzzleId !== 'string'
    || value.puzzleId.length === 0
    || typeof value.puzzleDate !== 'string'
    || !Number.isInteger(value.puzzleNumber)
    || !isSubmittableRuleset(value.rulesetVersion)
    || !Array.isArray(value.completedAtBats)) {
    return false;
  }
  return true;
}

function isRecordStatus(value: unknown): value is RecordStatus {
  return value === 'pending'
    || value === 'submitted'
    || value === 'conflict'
    || value === 'rejected';
}

function cloneSubmission(submission: DailyCompletedResultSubmission): DailyCompletedResultSubmission {
  return {
    ...submission,
    completedAtBats: submission.completedAtBats.map(atBat => ({ ...atBat })),
  };
}

function isSubmittableRuleset(
  rulesetVersion: unknown,
): rulesetVersion is DailyCompletedResultRulesetVersion {
  return rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
    || rulesetVersion === CLASSIC_DAILY_RULESET_VERSION;
}

function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
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
