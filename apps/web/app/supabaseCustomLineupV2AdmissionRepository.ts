import 'server-only';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import type { DailyPointsSummary } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomLineupV2AdmissionInput = Readonly<{
  challengeId: string;
  browserKeyDigest: string;
  submissionId: string;
  atBatCount: number;
  summary: DailyPointsSummary & { strikeouts: number };
  awardedPoints: readonly number[];
}>;

function unavailable(): never {
  // Never propagate private SQL, player, attempt or scoring details.
  throw new Error('Private Custom Lineup v2 admission unavailable.');
}

/** Service-role-only wrapper around the existing, installed v2 all-or-nothing RPC. */
export function createSupabaseCustomLineupV2AdmissionRepository(client: SupabaseClient) {
  return {
    async admit(input: CustomLineupV2AdmissionInput):
      Promise<{ status: 'created' | 'existing'; submissionId: string }> {
      try {
        validateCustomLineupPuzzleId(input.challengeId);
        if (!/^[0-9a-f]{64}$/.test(input.browserKeyDigest)
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            .test(input.submissionId)
          || !Number.isInteger(input.atBatCount) || input.atBatCount < 1 || input.atBatCount > 10
          || input.awardedPoints.length !== input.atBatCount
          || input.awardedPoints.some(points => !Number.isFinite(points)
            || points < 0 || points > 4 || points * 2 !== Math.trunc(points * 2))
          || input.summary.totalAtBats !== input.atBatCount
          || input.summary.atBatsCompleted !== input.atBatCount
          || input.summary.maximumPoints !== input.atBatCount * 4
          || !input.summary.completed
          || input.summary.points !== input.awardedPoints.reduce((a, b) => a + b, 0)) {
          unavailable();
        }
        const response = await client.rpc('admit_custom_lineup_v2_completed_attempt', {
          p_challenge_id: input.challengeId,
          p_browser_key_digest: input.browserKeyDigest,
          p_summary: input.summary,
          p_awarded_points: [...input.awardedPoints],
        }).single();
        if (response.error !== null || response.data === null
          || typeof response.data !== 'object' || Array.isArray(response.data)) unavailable();
        const row = response.data as Record<string, unknown>;
        if (row.submission_id !== input.submissionId || typeof row.created !== 'boolean') unavailable();
        return { status: row.created ? 'created' : 'existing', submissionId: input.submissionId };
      } catch {
        return unavailable();
      }
    },
  };
}
