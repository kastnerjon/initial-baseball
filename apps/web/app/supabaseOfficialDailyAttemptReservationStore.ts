import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OfficialDailyAttemptReservation, OfficialDailyAttemptReservationStore,
} from './officialDailyAttemptReservation';

/** Service-role-only adapter to the SQL first-start winner. Not a public route. */
export function createSupabaseOfficialDailyAttemptReservationStore(
  client: SupabaseClient,
): OfficialDailyAttemptReservationStore {
  return {
    async insertOrRead(candidate: OfficialDailyAttemptReservation) {
      let result;
      try {
        result = await client.rpc('reserve_official_daily_attempt', {
          p_puzzle_id: candidate.puzzleId,
          p_browser_key_digest: candidate.browserKeyDigest,
        }).single();
      } catch {
        throw new Error('Private official Daily reservation unavailable.');
      }
      if (result.error !== null || result.data === null ||
          typeof result.data !== 'object' || Array.isArray(result.data)) {
        throw new Error('Private official Daily reservation unavailable.');
      }
      const row = result.data as Record<string, unknown>;
      if (typeof row.attempt_id !== 'string' || typeof row.puzzle_id !== 'string'
        || typeof row.puzzle_date !== 'string' || row.ruleset_version !== 'points-v4'
        || typeof row.browser_key_digest !== 'string'
        || typeof row.started_at !== 'string'
        || (row.status !== 'active' && row.status !== 'completed')
        || typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision)
        || row.revision < 0) {
        throw new Error('Private official Daily reservation invalid.');
      }
      return {
        attemptId: row.attempt_id,
        puzzleId: row.puzzle_id,
        puzzleDate: row.puzzle_date,
        rulesetVersion: 'points-v4' as const,
        browserKeyDigest: row.browser_key_digest,
        startedAt: row.started_at,
      };
    },
  };
}
