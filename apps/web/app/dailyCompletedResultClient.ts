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

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type TerminalStatus = 'submitted' | 'conflict' | 'rejected';
type RecordStatus = 'pending' | TerminalStatus;
type Identity = {
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  rulesetVersion: DailyCompletedResultRulesetVersion;
};
type SubmissionRecord = {
  version: typeof RECORD_VERSION;
  status: RecordStatus;
  submission: DailyCompletedResultSubmission;
};
type RecordRead =
  | { kind: 'missing' | 'invalid' }
  | { kind: 'valid'; record: SubmissionRecord };

export type CompletedDailyResultSubmissionInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};
export type SubmissionState =
  | RecordStatus | 'not_started' | 'unsupported' | 'unavailable';

type SubmissionRequest = (
  submission: DailyCompletedResultSubmission,
) => Promise<{ ok: boolean; status: number }>;

export function createDailyCompletedResultClient({
  storage,
  createSubmissionId,
  submitRequest,
}: {
  storage: StoragePort | null;
  createSubmissionId: () => string | null;
  submitRequest: SubmissionRequest;
}) {
  const inFlight = new Map<string, Promise<SubmissionState>>();

  return {
    async submitIfNeeded(
      input: CompletedDailyResultSubmissionInput,
      { allowCreate }: { allowCreate: boolean },
    ): Promise<SubmissionState> {
      if (!isSupportedRuleset(input.rulesetVersion)) return 'unsupported';
      if (storage === null) return 'unavailable';

      const identity: Identity = {
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
        if (!allowCreate) return 'not_started';
        const submissionId = createSubmissionId();
        if (!isSubmissionId(submissionId)) return 'unavailable';
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
            completedAtBats: cloneAtBats(input.completedAtBats),
          },
        };
        if (!writeRecord(storage, key, record)) return 'unavailable';
      } else {
        record = existing.record;
      }

      if (record.status !== 'pending') return record.status;
      const active = inFlight.get(key);
      if (active !== undefined) return active;

      const request = deliver(storage, key, record, submitRequest).finally(() => {
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
): Promise<SubmissionState> {
  return browserClient().submitIfNeeded(input, options);
}

async function deliver(
  storage: StoragePort,
  key: string,
  record: SubmissionRecord,
  submitRequest: SubmissionRequest,
): Promise<SubmissionState> {
  let response: { ok: boolean; status: number };
  try {
    response = await submitRequest({
      ...record.submission,
      completedAtBats: cloneAtBats(record.submission.completedAtBats),
    });
  } catch {
    return 'pending';
  }

  const status = responseStatus(response);
  if (status === 'pending') return status;

  const current = readRawRecord(storage, key);
  if (current.kind !== 'valid') return 'pending';
  if (current.record.submission.submissionId !== record.submission.submissionId) {
    return current.record.status;
  }
  if (current.record.status !== 'pending') return current.record.status;
  return writeRecord(storage, key, { ...current.record, status }) ? status : 'pending';
}

function responseStatus(response: { ok: boolean; status: number }): RecordStatus {
  if (response.ok) return 'submitted';
  if (response.status === 409) return 'conflict';
  if ([408, 425, 429].includes(response.status) || response.status >= 500) return 'pending';
  return response.status >= 400 && response.status < 500 ? 'rejected' : 'pending';
}

function readRecord(storage: StoragePort, key: string, identity: Identity): RecordRead {
  const result = readRawRecord(storage, key);
  if (result.kind !== 'valid') return result;
  const value = result.record.submission;
  return value.puzzleId === identity.puzzleId
    && value.puzzleDate === identity.puzzleDate
    && value.puzzleNumber === identity.puzzleNumber
    && value.rulesetVersion === identity.rulesetVersion
    ? result
    : { kind: 'invalid' };
}

function readRawRecord(storage: StoragePort, key: string): RecordRead {
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
  return isSubmissionRecord(value)
    ? { kind: 'valid', record: value }
    : { kind: 'invalid' };
}

function isSubmissionRecord(value: unknown): value is SubmissionRecord {
  if (!isObject(value)
    || value.version !== RECORD_VERSION
    || !isRecordStatus(value.status)
    || !isObject(value.submission)) return false;
  const submission = value.submission;
  return submission.schemaVersion === DAILY_COMPLETED_RESULT_SCHEMA_VERSION
    && isSubmissionId(submission.submissionId)
    && typeof submission.puzzleId === 'string'
    && submission.puzzleId.length > 0
    && typeof submission.puzzleDate === 'string'
    && Number.isInteger(submission.puzzleNumber)
    && isSupportedRuleset(submission.rulesetVersion)
    && Array.isArray(submission.completedAtBats);
}

function writeRecord(storage: StoragePort, key: string, record: SubmissionRecord): boolean {
  try {
    storage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function storageKey(identity: Pick<Identity, 'puzzleId' | 'puzzleDate' | 'rulesetVersion'>): string {
  return [
    STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.puzzleId),
  ].join(':');
}

function cloneAtBats(atBats: DailyCompletedAtBat[]): DailyCompletedAtBat[] {
  return atBats.map(atBat => ({ ...atBat }));
}

function isSupportedRuleset(value: unknown): value is DailyCompletedResultRulesetVersion {
  return value === POINTS_V3_DAILY_RULESET_VERSION || value === CLASSIC_DAILY_RULESET_VERSION;
}
function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function isRecordStatus(value: unknown): value is RecordStatus {
  return value === 'pending' || value === 'submitted' || value === 'conflict' || value === 'rejected';
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

let singleton: ReturnType<typeof createDailyCompletedResultClient> | null = null;
function browserClient() {
  singleton ??= createDailyCompletedResultClient({
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
  return singleton;
}
function browserStorage(): StoragePort | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
