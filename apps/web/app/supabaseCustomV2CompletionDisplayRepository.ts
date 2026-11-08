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

export type CustomV2CompletionDisplayRead =
  Pick<CustomV2CompletionDisplayWrite, 'puzzleId' | 'browserKeyDigest'>;

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

    /** Refresh readback: locate only the server-issued first attempt, never a caller-selected submission. */
    async read(input: CustomV2CompletionDisplayRead):
      Promise<CustomV2CompletionDisplayChoice | null> {
      try {
        validateCustomLineupPuzzleId(input.puzzleId);
        if (!/^[0-9a-f]{64}$/.test(input.browserKeyDigest)) unavailable();

        const attempt = await client.from('custom_nine_attempt_states')
          .select('attempt_id,status,creator_seen')
          .eq('challenge_id', input.puzzleId)
          .eq('browser_key_digest', input.browserKeyDigest)
          .maybeSingle();
        if (attempt.error !== null) unavailable();
        if (attempt.data === null) return null;
        if (typeof attempt.data !== 'object' || Array.isArray(attempt.data)) unavailable();
        const row = attempt.data as Record<string, unknown>;
        if (row.creator_seen === true || row.status === 'active') return null;
        if (row.creator_seen !== false || row.status !== 'completed'
          || typeof row.attempt_id !== 'string'
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            .test(row.attempt_id)) unavailable();

        const result = await client.from('custom_lineup_v2_completion_displays')
          .select('display_mode,display_name')
          .eq('submission_id', row.attempt_id)
          .maybeSingle();
        if (result.error !== null) unavailable();
        if (result.data === null) return null;
        if (typeof result.data !== 'object' || Array.isArray(result.data)) unavailable();
        const display = result.data as Record<string, unknown>;
        if (display.display_mode === 'anonymous' && display.display_name === null) {
          return { mode: 'anonymous', displayName: null };
        }
        if (display.display_mode === 'named') {
          const parsed = parseCompletionDisplayName(display.display_name);
          if (parsed.ok && parsed.displayName === display.display_name) {
            return { mode: 'named', displayName: parsed.displayName };
          }
        }
        return unavailable();
      } catch {
        return unavailable();
      }
    },
  };
}
