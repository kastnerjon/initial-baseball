import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomV2DisplayChoice = Readonly<
  { mode: 'anonymous'; displayName: null }
  | { mode: 'named'; displayName: string }
>;
export type CustomV2DisplayWrite = Readonly<{
  challengeId: string;
  browserKeyDigest: string;
  choice: CustomV2DisplayChoice;
}>;

function unavailable(): never {
  // Database, attempt existence, creator state, and original score are private.
  throw new Error('Private Custom Lineup v2 completion display unavailable.');
}

/** Strict service-only SQL adapter; never accepts a browser-chosen submission ID. */
export function createSupabaseCustomV2CompletionDisplayRepository(client: SupabaseClient) {
  return {
    async record(input: CustomV2DisplayWrite): Promise<'created' | 'existing'> {
      try {
        validateCustomLineupPuzzleId(input.challengeId);
        if (!/^[0-9a-f]{64}$/.test(input.browserKeyDigest)
          || (input.choice.mode !== 'anonymous' && input.choice.mode !== 'named')
          || (input.choice.mode === 'anonymous' && input.choice.displayName !== null)
          || (input.choice.mode === 'named' && (() => {
            const parsed = parseCompletionDisplayName(input.choice.displayName);
            return !parsed.ok || parsed.displayName !== input.choice.displayName;
          })())) unavailable();
        const result = await client.rpc('record_custom_lineup_v2_completion_display', {
          p_challenge_id: input.challengeId,
          p_browser_key_digest: input.browserKeyDigest,
          p_display_mode: input.choice.mode,
          p_display_name: input.choice.displayName,
        }).single();
        if (result.error !== null || result.data === null
          || typeof result.data !== 'object' || Array.isArray(result.data)) unavailable();
        const row = result.data as Record<string, unknown>;
        if (typeof row.created !== 'boolean' || Object.keys(row).length !== 1) unavailable();
        return row.created ? 'created' : 'existing';
      } catch {
        return unavailable();
      }
    },
  };
}
