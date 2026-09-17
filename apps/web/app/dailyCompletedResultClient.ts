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

const SUBMISSION_STORAGE_PREFIX = 'initial-baseball:daily-result-submission:v1';
const SUBMISSION_MARKER_VERSION = 1 as const;

type SubmissionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type SubmissionMarkerStatus = 'pending' | 'submitted' | 'conflict' | 'rejected';

type SubmissionMarker = {
  version: typeof SUBMISSION_MARKER_VERSION;
  submissionId: string;
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: DailyCompletedResultRulesetVersion;
  status: SubmissionMarkerStatus;
};

export type CompletedDailyResultSubmissionInput = {
  puzzle: Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>;
  rulesetVersion: DailyRulesetVersion;
  completedAtBats: DailyCompletedAtBat[];
};

export type CompletedDailyResultSubmissionState =
  | SubmissionMarkerStatus
  | 'unsupported'
  | 'unavailable';

type SubmissionRequest = (
  submission: DailyCompletedResultSubmission,
) => Promise<{ ok: boolean; status: number }>;

type CreateDailyCompletedResultClientInput = {
  storage: SubmissionStorage | null;
  createSubmissionId: () => string | null;
  submitRequest: SubmissionRequest;
};

export function createDailyCompletedResultClient({
  storage,
  createSubmissionId,
  submitRequest,
}: CreateDailyCompletedResultClientInput) {
  return {
    async submitIfNeeded(
      input: CompletedDailyResultSubmissionInput,
    ): Promise<CompletedDailyResultSubmissionState> {
      if (!isSubmittableRuleset(input.rulesetVersion)) return 'unsupported';
      if (storage === null) return 'unavailable';

      const identity = {
        puzzleId: input.puzzle.id,
        puzzleDate: input.puzzle.puzzleDate,
        rulesetVersion: input.rulesetVersion,
      };
      const key = getSubmissionStorageKey(identity);
      let marker = readMarker(storage, key, identity);

      if (marker === null) {
        const submissionId = createSubmissionId();
        if (submissionId === null || !isSubmissionId(submissionId)) return 'unavailable';
        marker = {
          version: SUBMISSION_MARKER_VERSION,
          submissionId,
          ...identity,
          status: 'pending',
        };
        if (!writeMarker(storage, key, marker)) return 'unavailable';
      }

      if (marker.status !== 'pending') return marker.status;

      const submission: DailyCompletedResultSubmission = {
        schemaVersion: DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
        submissionId: marker.submissionId,
        puzzleId: input.puzzle.id,
        puzzleDate: input.puzzle.puzzleDate,
        puzzleNumber: input.puzzle.puzzleNumber,
        rulesetVersion: input.rulesetVersion,
        completedAtBats: input.completedAtBats.map(atBat => ({ ...atBat })),
      };

      let response: { ok: boolean; status: number };
      try {
        response = await submitRequest(submission);
      } catch {
        return 'pending';
      }

      if (response.ok) return persistStatus(storage, key, marker, 'submitted');
      if (response.status === 409) return persistStatus(storage, key, marker, 'conflict');
      if (response.status >= 400 && response.status < 500) {
        return persistStatus(storage, key, marker, 'rejected');
      }
      return 'pending';
    },

    clear(input: Pick<CompletedDailyResultSubmissionInput, 'puzzle' | 'rulesetVersion'>): void {
      if (storage === null || !isSubmittableRuleset(input.rulesetVersion)) return;
      safelyRemove(storage, getSubmissionStorageKey({
        puzzleId: input.puzzle.id,
        puzzleDate: input.puzzle.puzzleDate,
        rulesetVersion: input.rulesetVersion,
      }));
    },
  };
}

export async function submitCompletedDailyResultIfNeeded(
  input: CompletedDailyResultSubmissionInput,
): Promise<CompletedDailyResultSubmissionState> {
  return createBrowserClient().submitIfNeeded(input);
}

export function clearCompletedDailyResultSubmission(
  input: Pick<CompletedDailyResultSubmissionInput, 'puzzle' | 'rulesetVersion'>,
): void {
  createBrowserClient().clear(input);
}

function createBrowserClient() {
  return createDailyCompletedResultClient({
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
}

function persistStatus(
  storage: SubmissionStorage,
  key: string,
  marker: SubmissionMarker,
  status: Exclude<SubmissionMarkerStatus, 'pending'>,
): SubmissionMarkerStatus {
  const next = { ...marker, status };
  return writeMarker(storage, key, next) ? status : marker.status;
}

function getSubmissionStorageKey(identity: {
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: DailyCompletedResultRulesetVersion;
}): string {
  return [
    SUBMISSION_STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.puzzleId),
  ].join(':');
}

function readMarker(
  storage: SubmissionStorage,
  key: string,
  identity: {
    puzzleId: string;
    puzzleDate: string;
    rulesetVersion: DailyCompletedResultRulesetVersion;
  },
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
    || value.version !== SUBMISSION_MARKER_VERSION
    || !isSubmissionId(value.submissionId)
    || value.puzzleId !== identity.puzzleId
    || value.puzzleDate !== identity.puzzleDate
    || value.rulesetVersion !== identity.rulesetVersion
    || (value.status !== 'pending'
      && value.status !== 'submitted'
      && value.status !== 'conflict'
      && value.status !== 'rejected')) {
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
    // Result persistence must never block local gameplay/reset.
  }
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

function isSubmittableRuleset(
  rulesetVersion: DailyRulesetVersion,
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
