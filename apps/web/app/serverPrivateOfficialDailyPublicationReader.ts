import 'server-only';
import {
  clonePermanentDailyIssuedClueSnapshot,
  getDailyPuzzleNumber,
  isOfficialDailyOccurrenceId,
  isOfficialDailyEditionKey,
  type PermanentDailyIssuedClueSnapshot,
} from '@initial-baseball/daily';
import { parseCustomLineupTitle, POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'official_daily_publications';
const COLUMNS = 'puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,schema_version,ruleset_version,clue_snapshot';
const PUZZLE_PREFIX = 'daily-ed-v1-';

export type PrivateOfficialDailyPublication = Readonly<{
  puzzleId: string;
  puzzleDate: string;
  puzzleNumber: number;
  editionKey: string;
  editionNumber: number;
  title: string;
  rulesetVersion: typeof POINTS_V4_DAILY_RULESET_VERSION;
  clueSnapshot: PermanentDailyIssuedClueSnapshot;
}>;

/**
 * Private service-role lookup by immutable occurrence ID.
 * This is NOT a public admission or serialization boundary. It returns answers
 * and unrevealed clues; future consumers must authorize game-date visibility,
 * progression, and purpose before releasing any projection to a browser.
 */
export async function readPrivateOfficialDailyPublication(
  client: SupabaseClient,
  puzzleId: string,
): Promise<PrivateOfficialDailyPublication | null> {
  if (typeof puzzleId !== 'string' || !puzzleId.startsWith(PUZZLE_PREFIX)
      || !isOfficialDailyOccurrenceId(puzzleId.slice(PUZZLE_PREFIX.length))) return null;

  try {
    const { data, error } = await client.from(TABLE).select(COLUMNS)
      .eq('puzzle_id', puzzleId).maybeSingle();
    if (error !== null) throw new Error('Read failed.');
    if (data === null) return null;

    const row = data as Record<string, unknown>;
    const date = row.puzzle_date;
    if (row.puzzle_id !== puzzleId || typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid identity.');
    const timestamp = Date.parse(date + 'T00:00:00.000Z');
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid date.');
    }
    if (!Number.isSafeInteger(row.puzzle_number) || row.puzzle_number !== getDailyPuzzleNumber(date) ||
      !Number.isSafeInteger(row.edition_number) || (row.edition_number as number) < 1 ||
      row.schema_version !== 1 || row.ruleset_version !== POINTS_V4_DAILY_RULESET_VERSION) {
      throw new Error('Invalid publication metadata.');
    }
    const key = row.edition_key;
    const title = row.title;
    if (!isOfficialDailyEditionKey(key) || typeof title !== 'string') throw new Error('Invalid edition metadata.');
    const parsedTitle = parseCustomLineupTitle(title);
    if (!parsedTitle.ok || parsedTitle.title !== title) throw new Error('Invalid title.');

    const clueSnapshot = clonePermanentDailyIssuedClueSnapshot(
      row.clue_snapshot as PermanentDailyIssuedClueSnapshot,
    );
    return {
      puzzleId,
      puzzleDate: date,
      puzzleNumber: row.puzzle_number as number,
      editionKey: key,
      editionNumber: row.edition_number as number,
      title,
      rulesetVersion: POINTS_V4_DAILY_RULESET_VERSION,
      clueSnapshot,
    };
  } catch {
    // Never expose PostgREST details, future canonical IDs, or unrevealed hints.
    throw new Error('Unable to read official Daily publication.');
  }
}
