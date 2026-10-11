import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseCustomNineAdmissionRepository, type CustomNineAdmissionInput,
} from './supabaseCustomNineAdmissionRepository';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
const input: CustomNineAdmissionInput = {
  challengeId: ID, browserKeyDigest: 'a'.repeat(64), submissionId: ATTEMPT,
  summary: {
    points: 28.5, maximumPoints: 36, atBatsCompleted: 9,
    totalAtBats: 9, completed: true, strikeouts: 1,
  },
  awardedPoints: [4, 4, 4, 0.5, 4, 0, 4, 4, 4],
};
function setup(data: unknown = { submission_id: ATTEMPT, created: true }, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ single });
  return { rpc, single, repository: createSupabaseCustomNineAdmissionRepository(
    { rpc } as unknown as SupabaseClient,
  ) };
}

describe('private Custom Nine atomic admission RPC adapter', () => {
  it('uses only the service-role RPC and passes no client-selected result facts', async () => {
    const s = setup();
    expect(await s.repository.admit(input)).toEqual({ status: 'created', submissionId: ATTEMPT });
    expect(s.rpc).toHaveBeenCalledWith('admit_custom_nine_completed_attempt', {
      p_challenge_id: ID, p_browser_key_digest: input.browserKeyDigest,
      p_summary: input.summary, p_awarded_points: input.awardedPoints,
    });
    expect(s.rpc).toHaveBeenCalledTimes(1);
  });

  it('returns the existing server-owned result on an exact transactional retry', async () => {
    const s = setup({ submission_id: ATTEMPT, created: false });
    expect(await s.repository.admit(input)).toEqual({ status: 'existing', submissionId: ATTEMPT });
  });

  it('fails closed on unexpected winner, malformed shape, database errors or exceptions', async () => {
    for (const row of [
      { submission_id: 'other', created: true },
      { submission_id: ATTEMPT, created: 'true' },
      null,
    ]) {
      const s = setup(row);
      await expect(s.repository.admit(input)).rejects.toThrow('Private Custom Nine admission unavailable.');
    }
    const failure = setup(null, { code: '23505', message: 'PRIVATE_ROW_DETAILS' });
    await expect(failure.repository.admit(input)).rejects.toThrow('Private Custom Nine admission unavailable.');
    const thrown = setup();
    thrown.single.mockRejectedValueOnce(new Error('PRIVATE_PROVIDER_DETAILS'));
    await expect(thrown.repository.admit(input)).rejects.toThrow('Private Custom Nine admission unavailable.');
  });

  it('rejects invalid challenge, browser digest, UUID or wrong award count before RPC', async () => {
    const s = setup();
    for (const damaged of [
      { ...input, challengeId: 'daily-1' },
      { ...input, browserKeyDigest: 'bad' },
      { ...input, submissionId: 'browser-picked-id' },
      { ...input, awardedPoints: [4] },
    ]) await expect(s.repository.admit(damaged)).rejects.toThrow('Private Custom Nine admission unavailable.');
    expect(s.rpc).not.toHaveBeenCalled();
  });
});
