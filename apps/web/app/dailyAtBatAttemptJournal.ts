'use client';

import {
  DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyAtBatResultSubmission,
  type DailyCompletedAtBat,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';

const STORAGE_PREFIX = 'initial-baseball:daily-at-bat-attempt:v1';
const RECORD_VERSION = 1 as const;
const FIRST_GENERATION = 1;

export type DailyAtBatAttemptIdentity = Pick<DailyPublicPuzzle, 'id' | 'puzzleDate' | 'puzzleNumber'>
  & { rulesetVersion: typeof POINTS_V3_DAILY_RULESET_VERSION };

export type DailyAtBatDeliveryStatus = 'pending' | 'submitted' | 'conflict' | 'rejected';
export type DailyAtBatContributionState = 'active' | 'retired';
export type DailyAtBatObservation = {
  submission: DailyAtBatResultSubmission;
  delivery: DailyAtBatDeliveryStatus;
};
export type DailyAtBatAttemptJournal = {
  version: typeof RECORD_VERSION;
  identity: DailyAtBatAttemptIdentity;
  attemptId: string;
  contributionState: DailyAtBatContributionState;
  generation: number;
  observations: Record<string, DailyAtBatObservation>;
};

export type JournalRead = { kind: 'missing' } | { kind: 'invalid' | 'unavailable' }
  | { kind: 'valid'; journal: DailyAtBatAttemptJournal };

export type JournalMutationStatus =
  | 'created'
  | 'existing'
  | 'updated'
  | 'missing'
  | 'invalid'
  | 'unavailable'
  | 'stale'
  | 'retired'
  | 'observation_conflict';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

type DeliveryUpdateInput = { identity: DailyAtBatAttemptIdentity; generation: number;
  submission: DailyAtBatResultSubmission; delivery: Exclude<DailyAtBatDeliveryStatus, 'pending'> };

export function createDailyAtBatAttemptJournalStore({
  storage,
  createAttemptId,
}: {
  storage: StoragePort | null;
  createAttemptId: () => string | null;
}) {
  return {
    read(identity: DailyAtBatAttemptIdentity): JournalRead {
      return readJournal(storage, identity);
    },

    create(identity: DailyAtBatAttemptIdentity): JournalMutationStatus {
      if (storage === null) return 'unavailable';
      const current = readJournal(storage, identity);
      if (current.kind === 'valid') return 'existing';
      if (current.kind !== 'missing') return current.kind;

      const attemptId = createAttemptId();
      if (!isSubmissionId(attemptId)) return 'unavailable';
      const journal: DailyAtBatAttemptJournal = {
        version: RECORD_VERSION,
        identity: cloneIdentity(identity),
        attemptId,
        contributionState: 'active',
        generation: FIRST_GENERATION,
        observations: {},
      };
      return writeJournal(storage, identity, journal) ? 'created' : 'unavailable';
    },

    advanceGeneration(identity: DailyAtBatAttemptIdentity): JournalMutationStatus {
      if (storage === null) return 'unavailable';
      const current = readJournal(storage, identity);
      if (current.kind !== 'valid') return current.kind;
      const next = { ...current.journal, generation: current.journal.generation + 1 };
      return writeJournal(storage, identity, next) ? 'updated' : 'unavailable';
    },

    appendObservation(input: {
      identity: DailyAtBatAttemptIdentity;
      generation: number;
      atBat: DailyCompletedAtBat;
    }): JournalMutationStatus {
      if (storage === null) return 'unavailable';
      const current = readJournal(storage, input.identity);
      if (current.kind !== 'valid') return current.kind;
      if (current.journal.generation !== input.generation) return 'stale';
      if (current.journal.contributionState !== 'active') return 'retired';

      const submission = buildSubmission(current.journal, input.atBat);
      if (submission === null) return 'invalid';
      const slot = String(submission.atBat.pitchNumber);
      const existing = current.journal.observations[slot];
      if (existing !== undefined) {
        if (equalSubmission(existing.submission, submission)) return 'existing';
        const retired = { ...current.journal, contributionState: 'retired' as const };
        return writeJournal(storage, input.identity, retired)
          ? 'observation_conflict'
          : 'unavailable';
      }

      const next: DailyAtBatAttemptJournal = {
        ...current.journal,
        observations: {
          ...current.journal.observations,
          [slot]: { submission, delivery: 'pending' },
        },
      };
      return writeJournal(storage, input.identity, next) ? 'created' : 'unavailable';
    },

    retire(identity: DailyAtBatAttemptIdentity, generation: number): JournalMutationStatus {
      if (storage === null) return 'unavailable';
      const current = readJournal(storage, identity);
      if (current.kind !== 'valid') return current.kind;
      if (current.journal.generation !== generation) return 'stale';
      if (current.journal.contributionState === 'retired') return 'existing';
      const next = { ...current.journal, contributionState: 'retired' as const };
      return writeJournal(storage, identity, next) ? 'updated' : 'unavailable';
    },

    updateDelivery(input: DeliveryUpdateInput): JournalMutationStatus {
      if (storage === null) return 'unavailable';
      const current = readJournal(storage, input.identity);
      if (current.kind !== 'valid') return current.kind;
      if (current.journal.generation !== input.generation) return 'stale';

      const slot = String(input.submission.atBat.pitchNumber);
      const observation = current.journal.observations[slot];
      if (observation === undefined) return 'missing';
      if (!equalSubmission(observation.submission, input.submission)) return 'stale';
      if (observation.delivery !== 'pending') return 'existing';

      const retire = input.delivery === 'conflict' || input.delivery === 'rejected';
      const next: DailyAtBatAttemptJournal = {
        ...current.journal,
        contributionState: retire ? 'retired' : current.journal.contributionState,
        observations: {
          ...current.journal.observations,
          [slot]: { submission: cloneSubmission(observation.submission), delivery: input.delivery },
        },
      };
      return writeJournal(storage, input.identity, next) ? 'updated' : 'unavailable';
    },
  };
}

function readJournal(
  storage: StoragePort | null,
  identity: DailyAtBatAttemptIdentity,
): JournalRead {
  if (storage === null) return { kind: 'unavailable' };
  let raw: string | null;
  try { raw = storage.getItem(storageKey(identity)); } catch { return { kind: 'unavailable' }; }
  if (raw === null) return { kind: 'missing' };

  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: 'invalid' }; }
  if (!isJournal(value) || !equalIdentity(value.identity, identity)) return { kind: 'invalid' };
  return { kind: 'valid', journal: cloneJournal(value) };
}

function writeJournal(
  storage: StoragePort,
  identity: DailyAtBatAttemptIdentity,
  journal: DailyAtBatAttemptJournal,
): boolean {
  try {
    storage.setItem(storageKey(identity), JSON.stringify(journal));
    return true;
  } catch {
    return false;
  }
}
function buildSubmission(
  journal: DailyAtBatAttemptJournal,
  atBat: DailyCompletedAtBat,
): DailyAtBatResultSubmission | null {
  if (!isAtBat(atBat)) return null;
  return {
    schemaVersion: DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
    attemptId: journal.attemptId,
    puzzleId: journal.identity.id,
    puzzleDate: journal.identity.puzzleDate,
    puzzleNumber: journal.identity.puzzleNumber,
    rulesetVersion: POINTS_V3_DAILY_RULESET_VERSION,
    atBat: { ...atBat },
  };
}

function storageKey(identity: DailyAtBatAttemptIdentity): string {
  return [
    STORAGE_PREFIX,
    identity.rulesetVersion,
    identity.puzzleDate,
    encodeURIComponent(identity.id),
  ].join(':');
}

function isJournal(value: unknown): value is DailyAtBatAttemptJournal {
  if (!isObject(value) || value.version !== RECORD_VERSION) return false;
  const identity = value.identity;
  const observations = value.observations;
  if (!isIdentity(identity) || !isSubmissionId(value.attemptId)) return false;
  if (value.contributionState !== 'active' && value.contributionState !== 'retired') return false;
  if (!Number.isInteger(value.generation) || Number(value.generation) < FIRST_GENERATION) return false;
  if (!isObject(observations)) return false;

  return Object.entries(observations).every(([slot, observation]) => {
    if (!/^[1-9]$/.test(slot) || !isObject(observation)) return false;
    if (!isDeliveryStatus(observation.delivery) || !isSubmission(observation.submission)) return false;
    return String(observation.submission.atBat.pitchNumber) === slot
      && observation.submission.attemptId === value.attemptId
      && observation.submission.puzzleId === identity.id
      && observation.submission.puzzleDate === identity.puzzleDate
      && observation.submission.puzzleNumber === identity.puzzleNumber
      && observation.submission.rulesetVersion === identity.rulesetVersion;
  });
}

function isIdentity(value: unknown): value is DailyAtBatAttemptIdentity {
  return isObject(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.puzzleDate === 'string' && value.puzzleDate.length > 0
    && Number.isInteger(value.puzzleNumber)
    && value.rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION;
}
function isSubmission(value: unknown): value is DailyAtBatResultSubmission {
  return isObject(value)
    && value.schemaVersion === DAILY_AT_BAT_RESULT_SCHEMA_VERSION
    && isSubmissionId(value.attemptId)
    && typeof value.puzzleId === 'string'
    && typeof value.puzzleDate === 'string'
    && Number.isInteger(value.puzzleNumber)
    && value.rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION
    && isAtBat(value.atBat);
}
function isAtBat(value: unknown): value is DailyCompletedAtBat {
  if (!isObject(value)) return false;
  return Number.isInteger(value.pitchNumber) && Number(value.pitchNumber) >= 1 && Number(value.pitchNumber) <= 9
    && typeof value.initials === 'string' && value.initials.length > 0
    && ['HR', '3B', '2B', '1B', 'BB', 'K'].includes(String(value.outcome))
    && Number.isInteger(value.hintsRevealed) && Number(value.hintsRevealed) >= 0 && Number(value.hintsRevealed) <= 4
    && Number.isInteger(value.wrongGuesses) && Number(value.wrongGuesses) >= 0 && Number(value.wrongGuesses) <= 3
    && ['correct', 'strikeout', 'give_up'].includes(String(value.resolution));
}
function isDeliveryStatus(value: unknown): value is DailyAtBatDeliveryStatus {
  return value === 'pending' || value === 'submitted' || value === 'conflict' || value === 'rejected';
}
function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function equalIdentity(a: DailyAtBatAttemptIdentity, b: DailyAtBatAttemptIdentity): boolean {
  return a.id === b.id && a.puzzleDate === b.puzzleDate
    && a.puzzleNumber === b.puzzleNumber && a.rulesetVersion === b.rulesetVersion;
}
function equalSubmission(a: DailyAtBatResultSubmission, b: DailyAtBatResultSubmission): boolean {
  return a.schemaVersion === b.schemaVersion
    && a.attemptId === b.attemptId
    && a.puzzleId === b.puzzleId
    && a.puzzleDate === b.puzzleDate
    && a.puzzleNumber === b.puzzleNumber
    && a.rulesetVersion === b.rulesetVersion
    && a.atBat.pitchNumber === b.atBat.pitchNumber
    && a.atBat.initials === b.atBat.initials
    && a.atBat.outcome === b.atBat.outcome
    && a.atBat.hintsRevealed === b.atBat.hintsRevealed
    && a.atBat.wrongGuesses === b.atBat.wrongGuesses
    && a.atBat.resolution === b.atBat.resolution;
}
function cloneIdentity(identity: DailyAtBatAttemptIdentity): DailyAtBatAttemptIdentity { return { ...identity }; }
function cloneSubmission(submission: DailyAtBatResultSubmission): DailyAtBatResultSubmission {
  return { ...submission, atBat: { ...submission.atBat } };
}
function cloneJournal(journal: DailyAtBatAttemptJournal): DailyAtBatAttemptJournal {
  return {
    ...journal,
    identity: cloneIdentity(journal.identity),
    observations: Object.fromEntries(Object.entries(journal.observations).map(([slot, observation]) => [
      slot,
      { submission: cloneSubmission(observation.submission), delivery: observation.delivery },
    ])),
  };
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
