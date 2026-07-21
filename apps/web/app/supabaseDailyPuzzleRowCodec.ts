import type {
  DailyEditorialSelection,
  DailyPuzzleEditorialRecord,
  DailyPuzzleRepositorySaveOptions,
} from '@initial-baseball/daily';
import { DAILY_AT_BAT_COUNT, getDailyPuzzleNumber } from '@initial-baseball/daily';

export type SupabaseDailyPuzzleRepositoryErrorKind = 'conflict' | 'invalid-row' | 'query';

export class SupabaseDailyPuzzleRepositoryError extends Error {
  readonly name = 'SupabaseDailyPuzzleRepositoryError';

  constructor(
    readonly kind: SupabaseDailyPuzzleRepositoryErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export function validateDailyPuzzleRevisionTransition(
  record: DailyPuzzleEditorialRecord,
  options: DailyPuzzleRepositorySaveOptions,
): void {
  const expectedRecordRevision = options.expectedRevision === null
    ? 0
    : options.expectedRevision + 1;
  if (record.revision !== expectedRecordRevision) {
    throw new SupabaseDailyPuzzleRepositoryError(
      'invalid-row',
      `Daily puzzle ${record.puzzleDate} revision ${record.revision} does not follow expected revision ${String(options.expectedRevision)}.`,
    );
  }
}

export function encodeDailyPuzzleInsert(
  record: DailyPuzzleEditorialRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    puzzle_date: record.puzzleDate,
    puzzle_number: record.puzzleNumber,
    version: record.version,
    revision: record.revision,
    status: record.status,
    selections: record.selections.map(selection => ({ ...selection })),
    created_at: record.createdAt,
    created_by: record.createdBy,
    updated_at: record.updatedAt,
    updated_by: record.updatedBy,
    scheduled_at: record.scheduledAt,
    scheduled_by: record.scheduledBy,
    published_at: record.publishedAt,
    published_by: record.publishedBy,
    archived_at: record.archivedAt,
    archived_by: record.archivedBy,
  };
}

export function encodeDailyPuzzleUpdate(
  record: DailyPuzzleEditorialRecord,
): Record<string, unknown> {
  return {
    revision: record.revision,
    status: record.status,
    selections: record.selections.map(selection => ({ ...selection })),
    updated_at: record.updatedAt,
    updated_by: record.updatedBy,
    scheduled_at: record.scheduledAt,
    scheduled_by: record.scheduledBy,
    published_at: record.publishedAt,
    published_by: record.publishedBy,
    archived_at: record.archivedAt,
    archived_by: record.archivedBy,
  };
}

export function decodeDailyPuzzleRow(value: unknown): DailyPuzzleEditorialRecord {
  const row = requireObject(value, 'Daily puzzle row');
  const record: DailyPuzzleEditorialRecord = {
    id: requireNonEmptyString(row.id, 'id'),
    puzzleDate: requireCalendarDate(row.puzzle_date, 'puzzle_date'),
    puzzleNumber: requireInteger(row.puzzle_number, 'puzzle_number', 1),
    version: requireInteger(row.version, 'version', 1),
    revision: requireInteger(row.revision, 'revision', 0),
    status: requireStatus(row.status),
    selections: requireSelections(row.selections),
    createdAt: requireTimestamp(row.created_at, 'created_at'),
    createdBy: requireNonEmptyString(row.created_by, 'created_by'),
    updatedAt: requireTimestamp(row.updated_at, 'updated_at'),
    updatedBy: requireNonEmptyString(row.updated_by, 'updated_by'),
    scheduledAt: requireNullableTimestamp(row.scheduled_at, 'scheduled_at'),
    scheduledBy: requireNullableNonEmptyString(row.scheduled_by, 'scheduled_by'),
    publishedAt: requireNullableTimestamp(row.published_at, 'published_at'),
    publishedBy: requireNullableNonEmptyString(row.published_by, 'published_by'),
    archivedAt: requireNullableTimestamp(row.archived_at, 'archived_at'),
    archivedBy: requireNullableNonEmptyString(row.archived_by, 'archived_by'),
  };

  if (record.puzzleNumber !== getDailyPuzzleNumber(record.puzzleDate)) {
    throwInvalidRow(`puzzle_number does not match ${record.puzzleDate}`);
  }
  validateLifecycleAudit(record);
  return record;
}

function requireSelections(value: unknown): readonly DailyEditorialSelection[] {
  if (!Array.isArray(value) || value.length !== DAILY_AT_BAT_COUNT) {
    throwInvalidRow(`selections must contain exactly ${DAILY_AT_BAT_COUNT} entries`);
  }
  const selections = value.map((entry, index): DailyEditorialSelection => {
    const selection = requireObject(entry, `selections[${index}]`);
    const slot = requireInteger(selection.slot, `selections[${index}].slot`, 1);
    if (slot > DAILY_AT_BAT_COUNT) throwInvalidRow(`selection slot ${slot} is out of range`);
    const source = selection.source;
    if (source !== 'generated' && source !== 'manual') {
      throwInvalidRow(`selections[${index}].source is invalid`);
    }
    return {
      slot,
      canonicalPlayerId: requireNonEmptyString(
        selection.canonicalPlayerId,
        `selections[${index}].canonicalPlayerId`,
      ),
      source,
    };
  });

  if (new Set(selections.map(selection => selection.slot)).size !== DAILY_AT_BAT_COUNT) {
    throwInvalidRow('selections contain duplicate slots');
  }
  if (new Set(selections.map(selection => selection.canonicalPlayerId)).size !== DAILY_AT_BAT_COUNT) {
    throwInvalidRow('selections contain duplicate canonical player IDs');
  }
  return selections.sort((left, right) => left.slot - right.slot);
}

function validateLifecycleAudit(record: DailyPuzzleEditorialRecord): void {
  const scheduled = record.scheduledAt !== null && record.scheduledBy !== null;
  const published = record.publishedAt !== null && record.publishedBy !== null;
  const archived = record.archivedAt !== null && record.archivedBy !== null;
  const valid = (
    (record.status === 'draft' && !scheduled && !published && !archived)
    || (record.status === 'scheduled' && scheduled && !published && !archived)
    || (record.status === 'published' && scheduled && published && !archived)
    || (record.status === 'archived' && scheduled && published && archived)
  );
  if (!valid) throwInvalidRow(`lifecycle audit metadata is inconsistent with status ${record.status}`);
}

function requireStatus(value: unknown): DailyPuzzleEditorialRecord['status'] {
  if (value === 'draft' || value === 'scheduled' || value === 'published' || value === 'archived') {
    return value;
  }
  throwInvalidRow('status is invalid');
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throwInvalidRow(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throwInvalidRow(`${field} is required`);
  return value;
}

function requireNullableNonEmptyString(value: unknown, field: string): string | null {
  return value === null ? null : requireNonEmptyString(value, field);
}

function requireInteger(value: unknown, field: string, minimum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throwInvalidRow(`${field} must be an integer greater than or equal to ${minimum}`);
  }
  return value as number;
}

function requireCalendarDate(value: unknown, field: string): string {
  const date = requireNonEmptyString(value, field);
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throwInvalidRow(`${field} is not a valid calendar date`);
  }
  return date;
}

function requireTimestamp(value: unknown, field: string): string {
  const timestamp = requireNonEmptyString(value, field);
  if (!Number.isFinite(Date.parse(timestamp))) throwInvalidRow(`${field} is not a valid timestamp`);
  return timestamp;
}

function requireNullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : requireTimestamp(value, field);
}

function throwInvalidRow(message: string): never {
  throw new SupabaseDailyPuzzleRepositoryError('invalid-row', `Invalid persisted Daily puzzle: ${message}.`);
}
