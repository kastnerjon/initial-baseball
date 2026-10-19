import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCustomLineupTitle } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './serverSupabaseClient';

const TITLE_LOOKUP_TIMEOUT_MS = 1200;

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
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, TITLE_LOOKUP_TIMEOUT_MS);
  });
  try {
    const query = createClient()
      .from('custom_nine_issued_challenges')
      .select('display_title')
      .eq('puzzle_id', puzzleId)
      .abortSignal(controller.signal)
      .maybeSingle();
    const result = await Promise.race([query, deadline]);
    if (result === null || result.error || result.data === null
      || typeof result.data !== 'object' || Array.isArray(result.data)) return null;
    const record = result.data as Record<string, unknown>;
    const parsed = parseCustomLineupTitle(record.display_title);
    return parsed.ok ? parsed.title : null;
  } catch {
    // A title lookup problem never blocks or changes the signed game attempt.
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
