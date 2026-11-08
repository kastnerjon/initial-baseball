import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import {
  getDailyPuzzleNumber,
  isOfficialDailyOccurrenceId,
  validateDailyEditorialSelectionsForContract,
  type DailyEditorialSelection,
  type OfficialDailyPublicationInput,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prepareServerOfficialDailyPublication } from './materializePermanentDailyIssuedClueSnapshot';
import {
  readPrivateOfficialDailyPublication,
  type PrivateOfficialDailyPublication,
} from './serverPrivateOfficialDailyPublicationReader';

const TABLE = 'official_daily_editorial_drafts';
const COLUMNS = 'occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,selections,status,revision';

export type OfficialDailyIssueStatus = 'created' | 'existing';
/** Sanitized domain failure; never embeds private clue or provider details. */
export class OfficialDailyIssueError extends Error {
  constructor(readonly kind: 'invalid' | 'conflict' | 'unavailable') {
    super('Official Daily issuance could not be verified.');
    this.name = 'OfficialDailyIssueError';
  }
}

type Draft = {
  occurrenceId: string;
  puzzleDate: string;
  puzzleNumber: number;
  editionKey: string;
  editionNumber: number;
  title: string;
  selections: readonly DailyEditorialSelection[];
  status: 'scheduled' | 'issued';
  revision: number;
};

/** Verify the database draft is complete and immutable-identity-consistent. */
function parseDraft(value: unknown, occurrenceId: string): Draft {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfficialDailyIssueError('unavailable');
  }
  const row = value as Record<string, unknown>;
  if (row.occurrence_id !== occurrenceId
      || typeof row.puzzle_date !== 'string'
      || !Number.isSafeInteger(row.puzzle_number)
      || row.puzzle_number !== getDailyPuzzleNumber(row.puzzle_date)
      || typeof row.edition_key !== 'string'
      || typeof row.title !== 'string'
      || !Number.isSafeInteger(row.edition_number)
      || (row.edition_number as number) < 2
      || !Number.isSafeInteger(row.revision)
      || (row.revision as number) < 0
      || !Array.isArray(row.selections)
      || !['scheduled', 'issued'].includes(row.status as string)) {
    throw new OfficialDailyIssueError('conflict');
  }
  try {
    validateDailyEditorialSelectionsForContract(row.selections as DailyEditorialSelection[], 1);
  } catch {
    throw new OfficialDailyIssueError('conflict');
  }
  return {
    occurrenceId, puzzleDate: row.puzzle_date,
    puzzleNumber: row.puzzle_number as number,
    editionKey: row.edition_key,
    editionNumber: row.edition_number as number,
    title: row.title,
    selections: row.selections as DailyEditorialSelection[],
    status: row.status as Draft['status'],
    revision: row.revision as number,
  };
}

/** Compare the immutable published edition with its original ordered roster. */
function matchesFrozenPublication(
  draft: Draft,
  frozen: PrivateOfficialDailyPublication | null,
): frozen is PrivateOfficialDailyPublication {
  if (frozen === null || frozen.puzzleId !== 'daily-ed-v1-' + draft.occurrenceId
      || frozen.puzzleDate !== draft.puzzleDate
      || frozen.puzzleNumber !== draft.puzzleNumber
      || frozen.editionKey !== draft.editionKey
      || frozen.editionNumber !== draft.editionNumber
      || frozen.title !== draft.title) return false;

  const ordered = [...draft.selections].sort((a, b) => a.slot - b.slot);
  return frozen.clueSnapshot.pitches.length === ordered.length
    && frozen.clueSnapshot.pitches.every((pitch, index) =>
      pitch.canonicalPlayerId === ordered[index]?.canonicalPlayerId
      && pitch.pitchNumber === index + 1);
}

/**
 * Server-only, idempotent issuance of one pre-scheduled secondary Daily.
 * A database function owns the row lock and two writes; never perform
 * publication and the issued transition as independent HTTP operations.
 */
export async function issuePrivateOfficialDaily(
  client: SupabaseClient,
  occurrenceId: string,
  expectedRevision: number,
): Promise<{ status: OfficialDailyIssueStatus; puzzleId: string }> {
  if (!isOfficialDailyOccurrenceId(occurrenceId)
      || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new OfficialDailyIssueError('invalid');
  }
  try {
    const { data, error } = await client.from(TABLE).select(COLUMNS)
      .eq('occurrence_id', occurrenceId).maybeSingle();
    if (error !== null) throw new OfficialDailyIssueError('unavailable');
    if (data === null) throw new OfficialDailyIssueError('conflict');
    const draft = parseDraft(data, occurrenceId);
    if (draft.revision !== expectedRevision) throw new OfficialDailyIssueError('conflict');

    const puzzleId = 'daily-ed-v1-' + occurrenceId;
    if (draft.status === 'issued') {
      // Existing frozen clues are authoritative even if baseball data later changes.
      const existing = await readPrivateOfficialDailyPublication(client, puzzleId);
      if (!matchesFrozenPublication(draft, existing)) {
        throw new OfficialDailyIssueError('conflict');
      }
      return { status: 'existing', puzzleId };
    }

    const input: OfficialDailyPublicationInput = {
      occurrenceId, editionKey: draft.editionKey,
      editionNumber: draft.editionNumber, title: draft.title,
      editorial: {
        puzzleDate: draft.puzzleDate, puzzleNumber: draft.puzzleNumber,
        status: 'scheduled', selections: draft.selections,
      },
    };
    let prepared: ReturnType<typeof prepareServerOfficialDailyPublication>;
    try {
      prepared = prepareServerOfficialDailyPublication(input);
    } catch {
      throw new OfficialDailyIssueError('conflict');
    }

    const result = await client.rpc('issue_official_daily_editorial_draft', {
      p_occurrence_id: occurrenceId,
      p_expected_revision: expectedRevision,
      p_clue_snapshot: prepared.clueSnapshot,
    });
    if (result.error !== null) throw new OfficialDailyIssueError('unavailable');
    if (!Array.isArray(result.data) || result.data.length !== 1) {
      throw new OfficialDailyIssueError('unavailable');
    }
    const row = result.data[0] as { status?: unknown; puzzle_id?: unknown };
    if (row.status === 'conflict' || row.status === 'not_found') {
      throw new OfficialDailyIssueError('conflict');
    }
    if ((row.status !== 'created' && row.status !== 'existing')
        || row.puzzle_id !== prepared.puzzleId) {
      throw new OfficialDailyIssueError('unavailable');
    }
    // Verify the frozen record itself, not merely the RPC's metadata.
    const frozen = await readPrivateOfficialDailyPublication(client, puzzleId);
    if (!matchesFrozenPublication(draft, frozen)
        || !isDeepStrictEqual(frozen.clueSnapshot, prepared.clueSnapshot)) {
      throw new OfficialDailyIssueError('unavailable');
    }
    return { status: row.status, puzzleId };
  } catch (error) {
    if (error instanceof OfficialDailyIssueError) throw error;
    // No provider query, player ID, hint value, or stack reaches callers.
    throw new OfficialDailyIssueError('unavailable');
  }
}
