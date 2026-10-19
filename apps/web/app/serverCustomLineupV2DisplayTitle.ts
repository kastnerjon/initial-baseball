import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCustomLineupTitle } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './serverSupabaseClient';

/** Metadata-only read for a holder of an unlisted v2 challenge link.
 * Never query/serialize answer IDs or clue snapshots. The page is noindex.
 * Title availability must never prevent a legitimate challenge from opening.
 */
export async function readCustomLineupV2DisplayTitle(
  puzzleId: string,
  createClient: () => SupabaseClient = createServerSupabaseClient,
): Promise<string | null> {
  try { validateCustomLineupPuzzleId(puzzleId); }
  catch { return null; }
  try {
    const { data, error } = await createClient()
      .from('custom_nine_issued_challenges')
      .select('display_title')
      .eq('puzzle_id', puzzleId)
      .maybeSingle();
    if (error || data === null || typeof data !== 'object' || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    const parsed = parseCustomLineupTitle(record.display_title);
    return parsed.ok ? parsed.title : null;
  } catch {
    // A title lookup problem does not affect the signed gameplay bootstrap.
    return null;
  }
}
