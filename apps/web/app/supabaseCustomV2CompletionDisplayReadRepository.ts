import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomV2StoredDisplay =
  | Readonly<{ mode: 'named'; displayName: string }>
  | Readonly<{ mode: 'anonymous'; displayName: null }>;

function unavailable(): never {
  throw new Error('Private Custom Lineup v2 completion display unavailable.');
}

/** Read-only, service-role-only port; the SQL function locks the exact first
 * admitted attempt and returns no score, submission ID or frozen clue.
 */
export function createSupabaseCustomV2CompletionDisplayReadRepository(client: SupabaseClient) {
  return {
    async read(challengeId: string, browserKeyDigest: string):
      Promise<CustomV2StoredDisplay | null> {
      try {
        validateCustomLineupPuzzleId(challengeId);
        if (!/^[0-9a-f]{64}$/.test(browserKeyDigest)) unavailable();
        const response = await client.rpc('read_custom_lineup_v2_completion_display', {
          p_challenge_id: challengeId,
          p_browser_key_digest: browserKeyDigest,
        }).maybeSingle();
        if (response.error !== null) unavailable();
        if (response.data === null) return null;
        if (typeof response.data !== 'object' || Array.isArray(response.data)) unavailable();
        const row = response.data as Record<string, unknown>;
        if (Object.keys(row).length !== 2) unavailable();
        if (row.display_mode === 'anonymous' && row.display_name === null) {
          return { mode: 'anonymous', displayName: null };
        }
        if (row.display_mode !== 'named') unavailable();
        const parsed = parseCompletionDisplayName(row.display_name);
        if (!parsed.ok || parsed.displayName !== row.display_name) unavailable();
        return { mode: 'named', displayName: parsed.displayName };
      } catch {
        return unavailable();
      }
    },
  };
}
