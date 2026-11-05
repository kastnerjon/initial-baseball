import 'server-only';
import {
  getDailyPuzzleNumber, validateDailyEditorialSelectionsForContract,
  type DailyEditorialSelection, type OfficialDailyPublicationInput,
} from '@initial-baseball/daily';
import { parseCustomLineupTitle } from '@initial-baseball/shared';
import { isDeepStrictEqual } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';

const TABLE = 'official_daily_editorial_drafts';
const COLUMNS = 'occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,selections,status,revision,created_by';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EDITION_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type Kind = 'invalid' | 'conflict' | 'unavailable';

export class OfficialDailyDraftError extends Error {
  constructor(readonly kind: Kind) {
    super('Official Daily editorial draft could not be verified.');
    this.name = 'OfficialDailyDraftError';
  }
}
type Draft = {
  occurrence_id: string; puzzle_date: string; puzzle_number: number;
  edition_key: string; edition_number: number; title: string;
  selections: DailyEditorialSelection[]; status: 'draft' | 'scheduled' | 'issued';
  revision: number; created_by: string;
};
type NewDraft = {
  puzzleDate: string; puzzleNumber: number; editionKey: string;
  editionNumber: number; title: string; selections: DailyEditorialSelection[];
};
function invalid(): never { throw new OfficialDailyDraftError('invalid'); }
function unavailable(): never { throw new OfficialDailyDraftError('unavailable'); }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function parseOfficialDailyDraftInput(value: unknown, now: Date): NewDraft {
  if (!record(value) || Object.keys(value).some(key =>
      !['puzzleDate','editionKey','editionNumber','title','canonicalPlayerIds'].includes(key))) invalid();
  if (!validDate(value.puzzleDate) || value.puzzleDate <= getPacificDailyDateString(now)) invalid();
  const puzzleNumber = getDailyPuzzleNumber(value.puzzleDate);
  if (!Number.isSafeInteger(puzzleNumber) || puzzleNumber < 1
      || !Number.isSafeInteger(value.editionNumber) || ((value.editionNumber as number) < 2 || (value.editionNumber as number) > 2147483647)
      || typeof value.editionKey !== 'string' || value.editionKey.length > 64
      || !EDITION_KEY.test(value.editionKey)) invalid();
  const title = parseCustomLineupTitle(
    value.title === undefined ? 'Puzzle ' + String(value.editionNumber) : value.title,
  );
  if (!title.ok || !Array.isArray(value.canonicalPlayerIds)
      || value.canonicalPlayerIds.length !== 9
      || !value.canonicalPlayerIds.every(id =>
        typeof id === 'string' && id.length > 0 && id.trim() === id)) invalid();
  const selections: DailyEditorialSelection[] = value.canonicalPlayerIds.map(
    (canonicalPlayerId: string, index: number) => ({
      slot: index + 1, canonicalPlayerId, source: 'manual',
    }),
  );
  try { validateDailyEditorialSelectionsForContract(selections, 1); }
  catch { invalid(); }
  return {
    puzzleDate: value.puzzleDate, puzzleNumber, editionKey: value.editionKey,
    editionNumber: value.editionNumber as number, title: title.title, selections,
  };
}

function readDraft(value: unknown): Draft {
  if (!record(value) || typeof value.occurrence_id !== 'string' || !UUID.test(value.occurrence_id)
      || !validDate(value.puzzle_date) || value.puzzle_number !== getDailyPuzzleNumber(value.puzzle_date)
      || typeof value.edition_key !== 'string' || !EDITION_KEY.test(value.edition_key)
      || value.edition_key.length > 64 || !Number.isSafeInteger(value.edition_number)
      || (value.edition_number as number) < 2
      || typeof value.title !== 'string' || !parseCustomLineupTitle(value.title).ok
      || !Array.isArray(value.selections)
      || (value.status !== 'draft' && value.status !== 'scheduled' && value.status !== 'issued')
      || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0
      || typeof value.created_by !== 'string') unavailable();
  try { validateDailyEditorialSelectionsForContract(value.selections as DailyEditorialSelection[], 1); }
  catch { unavailable(); }
  return value as unknown as Draft;
}

export async function createOfficialDailyEditorialDraft(
  client: SupabaseClient, value: unknown, actorId: string, now: Date = new Date(),
) {
  const input = parseOfficialDailyDraftInput(value, now);
  const row = {
    puzzle_date: input.puzzleDate, puzzle_number: input.puzzleNumber,
    edition_key: input.editionKey, edition_number: input.editionNumber,
    title: input.title, selections: input.selections,
    created_by: actorId, updated_by: actorId,
  };
  try {
    const inserted = await client.from(TABLE).insert(row).select(COLUMNS).single();
    if (inserted.error === null) {
      const saved = readDraft(inserted.data);
      if (saved.status !== 'draft' || saved.revision !== 0) unavailable();
      return { status: 'created' as const, occurrenceId: saved.occurrence_id, revision: 0 };
    }
    if (inserted.error.code !== '23505') unavailable();
    const existing = await client.from(TABLE).select(COLUMNS)
      .eq('puzzle_date', input.puzzleDate).eq('edition_key', input.editionKey).maybeSingle();
    if (existing.error !== null) unavailable();
    if (existing.data === null) throw new OfficialDailyDraftError('conflict');
    const saved = readDraft(existing.data);
    if (saved.status !== 'draft' || saved.revision !== 0
        || saved.created_by !== actorId || saved.edition_number !== input.editionNumber
        || saved.title !== input.title || !isDeepStrictEqual(saved.selections, input.selections)) {
      throw new OfficialDailyDraftError('conflict');
    }
    return { status: 'existing' as const, occurrenceId: saved.occurrence_id, revision: 0 };
  } catch (error) {
    if (error instanceof OfficialDailyDraftError) throw error;
    unavailable();
  }
}

export async function scheduleOfficialDailyEditorialDraft(
  client: SupabaseClient, occurrenceId: string, expectedRevision: number,
  actorId: string, now: Date = new Date(),
) {
  if (typeof occurrenceId !== 'string' || !UUID.test(occurrenceId)
      || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) invalid();
  try {
    const found = await client.from(TABLE).select(COLUMNS)
      .eq('occurrence_id', occurrenceId).maybeSingle();
    if (found.error !== null) unavailable();
    if (found.data === null) throw new OfficialDailyDraftError('conflict');
    const draft = readDraft(found.data);
    if (draft.puzzle_date <= getPacificDailyDateString(now)) {
      throw new OfficialDailyDraftError('conflict');
    }
    if (draft.status === 'scheduled' && draft.revision === expectedRevision + 1) {
      return { status: 'existing' as const, occurrenceId, revision: draft.revision };
    }
    if (draft.status !== 'draft' || draft.revision !== expectedRevision) {
      throw new OfficialDailyDraftError('conflict');
    }
    const publication: OfficialDailyPublicationInput = {
      occurrenceId: draft.occurrence_id, editionKey: draft.edition_key,
      editionNumber: draft.edition_number, title: draft.title,
      editorial: {
        puzzleDate: draft.puzzle_date, puzzleNumber: draft.puzzle_number,
        status: 'scheduled', selections: draft.selections,
      },
    };
    try { prepareServerOfficialDailyPublication(publication); }
    catch { invalid(); }
    const updated = await client.from(TABLE)
      .update({ status: 'scheduled', revision: expectedRevision + 1,
        updated_by: actorId, updated_at: now.toISOString() })
      .eq('occurrence_id', occurrenceId).eq('status', 'draft').eq('revision', expectedRevision)
      .select(COLUMNS).maybeSingle();
    if (updated.error !== null) unavailable();
    if (updated.data === null) throw new OfficialDailyDraftError('conflict');
    const scheduled = readDraft(updated.data);
    if (scheduled.occurrence_id !== occurrenceId || scheduled.status !== 'scheduled'
        || scheduled.revision !== expectedRevision + 1) unavailable();
    return { status: 'scheduled' as const, occurrenceId, revision: scheduled.revision };
  } catch (error) {
    if (error instanceof OfficialDailyDraftError) throw error;
    unavailable();
  }
}
