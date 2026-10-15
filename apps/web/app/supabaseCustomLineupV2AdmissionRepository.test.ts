import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));

import {
  createSupabaseCustomLineupV2AdmissionRepository,
  type CustomLineupV2AdmissionInput,
} from './supabaseCustomLineupV2AdmissionRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
const input = (n: number): CustomLineupV2AdmissionInput => ({
  challengeId: ID, browserKeyDigest: 'a'.repeat(64),
  submissionId: ATTEMPT, atBatCount: n,
  summary: {
    points: 4 * n, maximumPoints: 4 * n,
    atBatsCompleted: n, totalAtBats: n,
    completed: true, strikeouts: 0,
  },
  awardedPoints: Array(n).fill(4) as number[],
});
function setup(data: unknown = { submission_id: ATTEMPT, created: true }, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ single });
  const repository = createSupabaseCustomLineupV2AdmissionRepository(
    { rpc } as unknown as SupabaseClient,
  );
  return { rpc, single, repository };
}
describe('private Custom v2 atomic admission repository adapter', () => {
  it.each([1, 5, 9, 10])('passes exactly N=%i server-scored points into the v2 RPC', async n => {
    const s = setup();
    const source = input(n);
    expect(await s.repository.admit(source)).toEqual({
      status: 'created', submissionId: ATTEMPT,
    });
    expect(s.rpc).toHaveBeenCalledOnce();
    expect(s.rpc).toHaveBeenCalledWith('admit_custom_lineup_v2_completed_attempt', {
      p_challenge_id: ID, p_browser_key_digest: source.browserKeyDigest,
      p_summary: source.summary, p_awarded_points: source.awardedPoints,
    });
    const rpcPayload = s.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(rpcPayload).not.toHaveProperty('submissionId');
    expect(rpcPayload).not.toHaveProperty('completedAtBats');
    expect(rpcPayload).not.toHaveProperty('atBatCount');
  });

  it('recognizes an exact transactional retry, not a newly admitted submission', async () => {
    const s = setup({ submission_id: ATTEMPT, created: false });
    expect(await s.repository.admit(input(10))).toEqual({
      status: 'existing', submissionId: ATTEMPT,
    });
  });

  it('rejects invalid IDs, lengths, award counts, ranges, steps and summaries before RPC', async () => {
    const s = setup(), original = input(5);
    for (const damaged of [
      { ...original, challengeId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000' },
      { ...original, browserKeyDigest: 'forged' },
      { ...original, submissionId: 'browser-picked-submission' },
      { ...original, atBatCount: 0 },
      { ...original, atBatCount: 11 },
      { ...original, awardedPoints: [4] },
      { ...original, awardedPoints: [4, 4, 4, 4, 4.1] },
      { ...original, awardedPoints: [4, 4, 4, 4, -0.5] },
      { ...original, awardedPoints: [4, 4, 4, 4, 4.25] },
      { ...original, summary: { ...original.summary, completed: false } },
      { ...original, summary: { ...original.summary, maximumPoints: 36 } },
      { ...original, summary: { ...original.summary, totalAtBats: 9 } },
      { ...original, summary: { ...original.summary, points: 19 } },
    ]) {
      await expect(s.repository.admit(damaged)).rejects.toThrow(
        'Private Custom Lineup v2 admission unavailable.');
    }
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed replies and wrong winner without leaking database details', async () => {
    for (const row of [
      { submission_id: 'other', created: true },
      { submission_id: ATTEMPT, created: 'yes' },
      null, [],
    ]) {
      const s = setup(row);
      await expect(s.repository.admit(input(5))).rejects.toThrow(
        'Private Custom Lineup v2 admission unavailable.');
    }
    const dbError = setup(null, { code: '23505', message: 'PRIVATE_SQL_DETAILS' });
    await expect(dbError.repository.admit(input(5))).rejects.toThrow(
      'Private Custom Lineup v2 admission unavailable.');
    const thrown = setup();
    thrown.single.mockRejectedValueOnce(new Error('PRIVATE_DB_DETAILS'));
    await expect(thrown.repository.admit(input(1))).rejects.toThrow(
      'Private Custom Lineup v2 admission unavailable.');
  });
});
