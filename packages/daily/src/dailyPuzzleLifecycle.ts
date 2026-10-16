import type { DailyPuzzleStatus } from '@initial-baseball/shared';
import { DAILY_AT_BAT_COUNT, getDailyPuzzleNumber } from './dailyPuzzleSelection';
import { isValidLineupLength } from './lineupLengthPolicy';

export type DailyEditorialSelectionSource = 'generated' | 'manual';

/** Explicit SQL editorial lineup contract, unrelated to record version/revision. */
export type DailyEditorialLineupContractVersion = 1 | 2;

export type DailyEditorialSelection = {
  slot: number;
  canonicalPlayerId: string;
  source: DailyEditorialSelectionSource;
};

export type DailyPuzzleEditorialRecord = {
  /** Legacy repository/service shape is contract 1 only; never accept prospective v2. */
  readonly lineupContractVersion?: never;
  id: string;
  puzzleDate: string;
  puzzleNumber: number;
  version: number;
  revision: number;
  status: DailyPuzzleStatus;
  selections: readonly DailyEditorialSelection[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  scheduledAt: string | null;
  scheduledBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
};

export type DailyPuzzleRepositorySaveOptions = {
  expectedRevision: number | null;
};

export interface DailyPuzzleRepository {
  getByDate(puzzleDate: string): Promise<DailyPuzzleEditorialRecord | null>;
  listByDateRange(startDate: string, endDate: string): Promise<readonly DailyPuzzleEditorialRecord[]>;
  save(
    record: DailyPuzzleEditorialRecord,
    options: DailyPuzzleRepositorySaveOptions,
  ): Promise<DailyPuzzleEditorialRecord>;
}

export type CreateDailyPuzzleDraftInput = {
  id: string;
  puzzleDate: string;
  puzzleNumber: number;
  selections: readonly DailyEditorialSelection[];
  actorId: string;
  occurredAt: string;
};

export type DailyPuzzleEditorialService = {
  createDraft(input: CreateDailyPuzzleDraftInput): Promise<DailyPuzzleEditorialRecord>;
  replaceSelection(input: {
    puzzleDate: string;
    slot: number;
    canonicalPlayerId: string;
    actorId: string;
    occurredAt: string;
  }): Promise<DailyPuzzleEditorialRecord>;
  replaceLineup(input: {
    puzzleDate: string;
    canonicalPlayerIds: readonly string[];
    actorId: string;
    occurredAt: string;
  }): Promise<DailyPuzzleEditorialRecord>;
  correctScheduledLineup(input: {
    puzzleDate: string;
    canonicalPlayerIds: readonly string[];
    actorId: string;
    occurredAt: string;
  }): Promise<DailyPuzzleEditorialRecord>;
  schedule(input: {
    puzzleDate: string;
    actorId: string;
    occurredAt: string;
  }): Promise<DailyPuzzleEditorialRecord>;
  publish(input: {
    puzzleDate: string;
    actorId: string;
    occurredAt: string;
  }): Promise<DailyPuzzleEditorialRecord>;
  archive(input: {
    puzzleDate: string;
    actorId: string;
    occurredAt: string;
  }): Promise<DailyPuzzleEditorialRecord>;
};

export function createDailyPuzzleEditorialService(
  repository: DailyPuzzleRepository,
): DailyPuzzleEditorialService {
  return {
    async createDraft(input) {
      const existing = await repository.getByDate(input.puzzleDate);
      if (existing !== null) {
        throw new Error(`Daily puzzle already exists for ${input.puzzleDate}.`);
      }

      const draft = createDailyPuzzleDraft(input);
      return repository.save(draft, { expectedRevision: null });
    },

    async replaceSelection(input) {
      const current = await requirePuzzle(repository, input.puzzleDate);
      const updated = replaceDailyPuzzleSelection(current, input);
      return repository.save(updated, { expectedRevision: current.revision });
    },

    async replaceLineup(input) {
      const current = await requirePuzzle(repository, input.puzzleDate);
      const updated = replaceDailyPuzzleLineup(current, input);
      return repository.save(updated, { expectedRevision: current.revision });
    },

    async correctScheduledLineup(input) {
      const current = await requirePuzzle(repository, input.puzzleDate);
      const updated = correctScheduledDailyPuzzleLineup(current, input);
      return repository.save(updated, { expectedRevision: current.revision });
    },

    async schedule(input) {
      const current = await requirePuzzle(repository, input.puzzleDate);
      const updated = scheduleDailyPuzzle(current, input);
      return repository.save(updated, { expectedRevision: current.revision });
    },

    async publish(input) {
      const current = await requirePuzzle(repository, input.puzzleDate);
      const updated = publishDailyPuzzle(current, input);
      return repository.save(updated, { expectedRevision: current.revision });
    },

    async archive(input) {
      const current = await requirePuzzle(repository, input.puzzleDate);
      const updated = archiveDailyPuzzle(current, input);
      return repository.save(updated, { expectedRevision: current.revision });
    },
  };
}

/**
 * Schema-contract-v2 editorial draft for a future five-at-bat Daily.
 * This pure constructor is not wired to the existing nine-only repository
 * or schedule/publish flows; activation requires a version-aware adapter.
 */
export type ProspectiveDailyFiveEditorialDraft =
  Omit<DailyPuzzleEditorialRecord, 'lineupContractVersion'> & {
    readonly lineupContractVersion: 2;
  };

export function createProspectiveDailyFiveEditorialDraft(
  input: CreateDailyPuzzleDraftInput,
): ProspectiveDailyFiveEditorialDraft {
  validateDate(input.puzzleDate);
  validatePuzzleNumber(input.puzzleDate, input.puzzleNumber);
  validateActorAndTimestamp(input.actorId, input.occurredAt);
  validateDailyEditorialSelectionsForContract(input.selections, 2);
  return { ...buildDailyPuzzleDraftRecord(input), lineupContractVersion: 2 };
}

export function createDailyPuzzleDraft(
  input: CreateDailyPuzzleDraftInput,
): DailyPuzzleEditorialRecord {
  validateDate(input.puzzleDate);
  validatePuzzleNumber(input.puzzleDate, input.puzzleNumber);
  validateActorAndTimestamp(input.actorId, input.occurredAt);
  validateSelections(input.selections);
  return buildDailyPuzzleDraftRecord(input);
}

function buildDailyPuzzleDraftRecord(
  input: CreateDailyPuzzleDraftInput,
): DailyPuzzleEditorialRecord {
  return {
    id: input.id,
    puzzleDate: input.puzzleDate,
    puzzleNumber: input.puzzleNumber,
    version: 1,
    revision: 0,
    status: 'draft',
    selections: normalizeSelections(input.selections),
    createdAt: input.occurredAt,
    createdBy: input.actorId,
    updatedAt: input.occurredAt,
    updatedBy: input.actorId,
    scheduledAt: null,
    scheduledBy: null,
    publishedAt: null,
    publishedBy: null,
    archivedAt: null,
    archivedBy: null,
  };
}

export function replaceDailyPuzzleSelection(
  record: DailyPuzzleEditorialRecord,
  input: {
    slot: number;
    canonicalPlayerId: string;
    actorId: string;
    occurredAt: string;
  },
): DailyPuzzleEditorialRecord {
  assertEditable(record);
  validateActorAndTimestamp(input.actorId, input.occurredAt);
  validateSlot(input.slot);
  validateCanonicalPlayerId(input.canonicalPlayerId);

  const selections = record.selections.map(selection => (
    selection.slot === input.slot
      ? { slot: input.slot, canonicalPlayerId: input.canonicalPlayerId, source: 'manual' as const }
      : selection
  ));
  validateSelections(selections);

  return touchRecord({
    ...record,
    status: 'draft',
    selections,
    scheduledAt: null,
    scheduledBy: null,
  }, input.actorId, input.occurredAt);
}

export function replaceDailyPuzzleLineup(
  record: DailyPuzzleEditorialRecord,
  input: {
    canonicalPlayerIds: readonly string[];
    actorId: string;
    occurredAt: string;
  },
): DailyPuzzleEditorialRecord {
  assertEditable(record);
  validateActorAndTimestamp(input.actorId, input.occurredAt);

  const selections: DailyEditorialSelection[] = input.canonicalPlayerIds.map((canonicalPlayerId, index) => ({
    slot: index + 1,
    canonicalPlayerId,
    source: 'manual',
  }));
  validateSelections(selections);

  return touchRecord({
    ...record,
    status: 'draft',
    selections: normalizeSelections(selections),
    scheduledAt: null,
    scheduledBy: null,
  }, input.actorId, input.occurredAt);
}

export function correctScheduledDailyPuzzleLineup(
  record: DailyPuzzleEditorialRecord,
  input: {
    canonicalPlayerIds: readonly string[];
    actorId: string;
    occurredAt: string;
  },
): DailyPuzzleEditorialRecord {
  if (record.status !== 'scheduled') {
    throw new Error(`Only scheduled Daily puzzles may be corrected; received ${record.status}.`);
  }
  validateActorAndTimestamp(input.actorId, input.occurredAt);

  const selections: DailyEditorialSelection[] = input.canonicalPlayerIds.map((canonicalPlayerId, index) => ({
    slot: index + 1,
    canonicalPlayerId,
    source: 'manual',
  }));
  validateSelections(selections);

  return touchRecord({
    ...record,
    selections: normalizeSelections(selections),
  }, input.actorId, input.occurredAt);
}

export function scheduleDailyPuzzle(
  record: DailyPuzzleEditorialRecord,
  input: { actorId: string; occurredAt: string },
): DailyPuzzleEditorialRecord {
  if (record.status !== 'draft') {
    throw new Error(`Only draft Daily puzzles may be scheduled; received ${record.status}.`);
  }
  validateActorAndTimestamp(input.actorId, input.occurredAt);
  validateSelections(record.selections);

  return touchRecord({
    ...record,
    status: 'scheduled',
    scheduledAt: input.occurredAt,
    scheduledBy: input.actorId,
  }, input.actorId, input.occurredAt);
}

export function publishDailyPuzzle(
  record: DailyPuzzleEditorialRecord,
  input: { actorId: string; occurredAt: string },
): DailyPuzzleEditorialRecord {
  if (record.status !== 'scheduled') {
    throw new Error(`Only scheduled Daily puzzles may be published; received ${record.status}.`);
  }
  validateActorAndTimestamp(input.actorId, input.occurredAt);

  return touchRecord({
    ...record,
    status: 'published',
    publishedAt: input.occurredAt,
    publishedBy: input.actorId,
  }, input.actorId, input.occurredAt);
}

export function archiveDailyPuzzle(
  record: DailyPuzzleEditorialRecord,
  input: { actorId: string; occurredAt: string },
): DailyPuzzleEditorialRecord {
  if (record.status !== 'published') {
    throw new Error(`Only published Daily puzzles may be archived; received ${record.status}.`);
  }
  validateActorAndTimestamp(input.actorId, input.occurredAt);

  return touchRecord({
    ...record,
    status: 'archived',
    archivedAt: input.occurredAt,
    archivedBy: input.actorId,
  }, input.actorId, input.occurredAt);
}

function touchRecord(
  record: DailyPuzzleEditorialRecord,
  actorId: string,
  occurredAt: string,
): DailyPuzzleEditorialRecord {
  return {
    ...record,
    revision: record.revision + 1,
    updatedAt: occurredAt,
    updatedBy: actorId,
  };
}

function assertEditable(record: DailyPuzzleEditorialRecord): void {
  if (record.status === 'published' || record.status === 'archived') {
    throw new Error(`Daily puzzle ${record.puzzleDate} is immutable in status ${record.status}.`);
  }
}

async function requirePuzzle(
  repository: DailyPuzzleRepository,
  puzzleDate: string,
): Promise<DailyPuzzleEditorialRecord> {
  const record = await repository.getByDate(puzzleDate);
  if (record === null) throw new Error(`Daily puzzle not found for ${puzzleDate}.`);
  return record;
}

function validateSelections(selections: readonly DailyEditorialSelection[]): void {
  // The existing draft/editor and scheduler must remain nine-only until a
  // separate version-aware persistence and issuance consumer is deployed.
  validateDailyEditorialSelectionsForContract(selections, 1);
}

/**
 * Portable editorial shape validation for the installed versioned SQL contract.
 * v1 remains nine; v2 is five. This does not create, schedule, or issue v2 puzzles.
 */
export function validateDailyEditorialSelectionsForContract(
  selections: readonly DailyEditorialSelection[],
  lineupContractVersion: DailyEditorialLineupContractVersion,
): void {
  if (lineupContractVersion !== 1 && lineupContractVersion !== 2) {
    throw new Error(`Unsupported Daily editorial lineup contract: ${String(lineupContractVersion)}.`);
  }

  const atBatCount = lineupContractVersion === 1 ? DAILY_AT_BAT_COUNT : 5;
  const lengthPolicy = lineupContractVersion === 1 ? 'legacy-daily-nine' : 'future-daily-five';
  if (!isValidLineupLength(lengthPolicy, selections.length)) {
    throw new Error(`Daily puzzle must contain exactly ${atBatCount} selections.`);
  }

  const slots = new Set<number>();
  const canonicalPlayerIds = new Set<string>();
  for (const selection of selections) {
    validateSlot(selection.slot, atBatCount);
    validateCanonicalPlayerId(selection.canonicalPlayerId);
    if (slots.has(selection.slot)) throw new Error(`Duplicate Daily puzzle slot: ${selection.slot}.`);
    if (canonicalPlayerIds.has(selection.canonicalPlayerId)) {
      throw new Error(`Duplicate canonical Daily player: ${selection.canonicalPlayerId}.`);
    }
    slots.add(selection.slot);
    canonicalPlayerIds.add(selection.canonicalPlayerId);
  }
}

function normalizeSelections(
  selections: readonly DailyEditorialSelection[],
): readonly DailyEditorialSelection[] {
  return [...selections]
    .sort((left, right) => left.slot - right.slot)
    .map(selection => ({ ...selection }));
}

function validateSlot(slot: number, atBatCount: number = DAILY_AT_BAT_COUNT): void {
  if (!Number.isInteger(slot) || slot < 1 || slot > atBatCount) {
    throw new Error(`Daily puzzle slot must be between 1 and ${atBatCount}; received ${slot}.`);
  }
}

function validateCanonicalPlayerId(canonicalPlayerId: string): void {
  if (canonicalPlayerId.trim().length === 0) {
    throw new Error('Daily puzzle canonical player ID is required.');
  }
}

function validatePuzzleNumber(puzzleDate: string, puzzleNumber: number): void {
  const expectedPuzzleNumber = getDailyPuzzleNumber(puzzleDate);
  if (puzzleNumber !== expectedPuzzleNumber) {
    throw new Error(
      `Daily puzzle number ${puzzleNumber} does not match ${puzzleDate}; expected ${expectedPuzzleNumber}.`,
    );
  }
}

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid Daily puzzle date: ${value}.`);
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid Daily puzzle date: ${value}.`);
  }
}

function validateActorAndTimestamp(actorId: string, occurredAt: string): void {
  if (actorId.trim().length === 0) throw new Error('Editorial actor ID is required.');
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new Error(`Invalid editorial timestamp: ${occurredAt}.`);
  }
}
