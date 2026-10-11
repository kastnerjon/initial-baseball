import 'server-only';
import type { DailyCompletedResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireCustomNineAttemptKey } from './customNineAttemptRowCodec';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';

export type CustomNineAdmissionInput = Readonly<{
  challengeId: string;
  browserKeyDigest: string;
  submissionId: string;
  summary: DailyCompletedResult['summary'];
  awardedPoints: readonly number[];
}>;

function unavailable(): never {
  // Never forward PostgREST/SQL detail or any private scored facts.
  throw new Error('Private Custom Nine admission unavailable.');
}

/** Only the server-authorized scorer calls this private, all-or-nothing RPC. */
export function createSupabaseCustomNineAdmissionRepository(client: SupabaseClient) {
  return {
    async admit(input: CustomNineAdmissionInput): Promise<{
      status: 'created' | 'existing'; submissionId: string;
    }> {
      try {
        validateCustomNinePuzzleId(input.challengeId);
        requireCustomNineAttemptKey(input.challengeId, input.browserKeyDigest);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
          .test(input.submissionId) || input.awardedPoints.length !== 9) unavailable();
        const result = await client.rpc('admit_custom_nine_completed_attempt', {
          p_challenge_id: input.challengeId,
          p_browser_key_digest: input.browserKeyDigest,
          p_summary: input.summary,
          p_awarded_points: [...input.awardedPoints],
        }).single();
        if (result.error !== null) unavailable();
        const row: unknown = result.data;
        if (row === null || typeof row !== 'object' || Array.isArray(row)) unavailable();
        const value = row as Record<string, unknown>;
        if (value.submission_id !== input.submissionId || typeof value.created !== 'boolean') unavailable();
        return { status: value.created ? 'created' : 'existing', submissionId: input.submissionId };
      } catch { return unavailable(); }
    },
  };
}
