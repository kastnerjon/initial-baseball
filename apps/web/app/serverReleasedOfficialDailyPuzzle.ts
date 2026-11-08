import 'server-only';
import type { DailyPuzzle } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { materializeOfficialDailyIssuedPuzzle } from './permanentDailyPuzzleMaterialization';
import { readPrivateOfficialDailyPublication } from './serverPrivateOfficialDailyPublicationReader';

/** Load a released edition for private gameplay. Never serialize its answer-bearing return value. */
export async function readReleasedOfficialDailyPuzzle(
  client: SupabaseClient,
  puzzleId: string,
  now: Date = new Date(),
): Promise<DailyPuzzle | null> {
  const publication = await readPrivateOfficialDailyPublication(client, puzzleId, now);
  return publication === null ? null : materializeOfficialDailyIssuedPuzzle(publication);
}
