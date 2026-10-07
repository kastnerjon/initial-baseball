import 'server-only';
import { resolveArchiveBetaDailyIdentityForDate, type ArchiveBetaDailyIdentity } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';

/** Metadata-only pages bound no-op work; never fetch historical answer/clue snapshots. */
export async function listIssuedArchiveBetaIdentities(client: SupabaseClient, cutoffDate: string) {
  const identities: ArchiveBetaDailyIdentity[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('permanent_daily_issued_puzzles')
      .select('daily_number,puzzle_date,puzzle_id')
      .eq('series_version', ARCHIVE_BETA_EPOCH.seriesVersion).eq('schema_version', 2)
      .gte('puzzle_date', ARCHIVE_BETA_EPOCH.startDate).lt('puzzle_date', cutoffDate)
      .order('daily_number', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw new Error('Issued archive identities are unavailable.');
    for (const row of data ?? []) {
      const identity = resolveArchiveBetaDailyIdentityForDate(row.puzzle_date, ARCHIVE_BETA_EPOCH);
      if (identity === null || identity.puzzleDate >= cutoffDate || identity.dailyNumber !== row.daily_number
        || row.puzzle_id !== `archive-beta-v1-daily-${identity.dailyNumber}`) throw new Error('Invalid issued archive identity.');
      identities.push(identity);
    }
    if ((data?.length ?? 0) < pageSize) return identities;
  }
}
