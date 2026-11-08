import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import { parseCompletionDisplayName } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomV2CompletionDisplayChoice =
  | Readonly<{ mode: 'named'; displayName: string }>
  | Readonly<{ mode: 'anonymous'; displayName: null }>;

export type CustomV2CompletionDisplayWrite = Readonly<{
  puzzleId: string;
  browserKeyDigest: string;
  choice: CustomV2CompletionDisplayChoice;
}>;

function isValidChoice(choice: CustomV2CompletionDisplayChoice): boolean {
  if (choice.mode === 'anonymous') return choice.displayName === null;
  if (choice.mode !== 'named') return false;
  const parsed = parseCompletionDisplayName(choice.displayName);
  return parsed.ok && parsed.displayName === choice.displayName;
}

function unavailable(): never {
  // Never surface SQL, attempts, player identity or stored name from provider failures.
  throw new Error('Private Custom completion display unavailable.');
}

/** Server-only RPC adapter. No client-selected result/submission identity exists. */
export function createSupabaseCustomV2CompletionDisplayRepository(client: SupabaseClient) {
  return {
    async write(input: CustomV2CompletionDisplayWrite):
      Promise<'created' | 'existing' | 'conflict'> {
      try {
        validateCustomLineupPuzzleId(input.puzzleId);
        if (!/^[0-9a-f]{64}$/.test(input.browserKeyDigest)
          || !isValidChoice(input.choice)) {
          unavailable();
        }
        const response = await client.rpc('record_custom_lineup_v2_completion_display', {
          p_challenge_id: input.puzzleId,
          p_browser_key_digest: input.browserKeyDigest,
          p_display_mode: input.choice.mode,
          p_display_name: input.choice.displayName,
        }).single();
        if (response.error !== null) {
          if (response.error.code === '23505') return 'conflict';
          unavailable();
        }
        if (response.data === null || typeof response.data !== 'object'
          || Array.isArray(response.data)) unavailable();
        const row = response.data as Record<string, unknown>;
        if (typeof row.created !== 'boolean') unavailable();
        return row.created ? 'created' : 'existing';
      } catch {
        return unavailable();
      }
    },
  };
}
