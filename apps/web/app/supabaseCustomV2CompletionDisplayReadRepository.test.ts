import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import { createSupabaseCustomV2CompletionDisplayReadRepository }
  from './supabaseCustomV2CompletionDisplayReadRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const DIGEST = 'a'.repeat(64);
function setup(data: unknown = { display_mode: 'named', display_name: 'Guest' }, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { rpc, maybeSingle, repo: createSupabaseCustomV2CompletionDisplayReadRepository(
    { rpc } as unknown as SupabaseClient,
  ) };
}
describe('private Custom v2 completed display readback RPC', () => {
  it('queries only exact challenge and digest and returns bounded first name', async () => {
    const s = setup();
    expect(await s.repo.read(ID, DIGEST)).toEqual({ mode: 'named', displayName: 'Guest' });
    expect(s.rpc).toHaveBeenCalledWith('read_custom_lineup_v2_completion_display', {
      p_challenge_id: ID, p_browser_key_digest: DIGEST,
    });
    const wire = JSON.stringify(s.rpc.mock.calls);
    expect(wire).not.toContain('submissionId');
    expect(wire).not.toContain('score');
    expect(wire).not.toContain('clue');
  });
  it('preserves Anonymous as a null-only private display, and no row as unset', async () => {
    const anonymous = setup({ display_mode: 'anonymous', display_name: null });
    expect(await anonymous.repo.read(ID, DIGEST))
      .toEqual({ mode: 'anonymous', displayName: null });
    const missing = setup(null);
    expect(await missing.repo.read(ID, DIGEST)).toBeNull();
  });
  it('fails before SQL on invalid challenge or digest', async () => {
    const s = setup();
    for (const [id,digest] of [
      [ID,'wrong'], ['custom-nine-v1-123e4567-e89b-42d3-a456-426614174000',DIGEST],
    ]) await expect(s.repo.read(id!,digest!)).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.',
    );
    expect(s.rpc).not.toHaveBeenCalled();
  });
  it('does not leak malformed mode, extra result metadata or provider errors', async () => {
    for (const row of [
      { display_mode: 'named', display_name: ' x ' },
      { display_mode: 'named', display_name: 'x'.repeat(33) },
      { display_mode: 'named', display_name: '<script>\n' },
      { display_mode: 'anonymous', display_name: 'LEAK' },
      { display_mode: 'named', display_name: 'Safe', submission_id: 'PRIVATE_UUID' },
      {}, [],
    ]) {
      const s = setup(row);
      await expect(s.repo.read(ID, DIGEST)).rejects.toThrow(
        'Private Custom Lineup v2 completion display unavailable.',
      );
    }
    const failed = setup(null, { message: 'PRIVATE_SCORE_DETAILS' });
    await expect(failed.repo.read(ID, DIGEST)).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.',
    );
    const rejected = setup();
    rejected.maybeSingle.mockRejectedValueOnce(new Error('PRIVATE_DB_DETAILS'));
    await expect(rejected.repo.read(ID, DIGEST)).rejects.toThrow(
      'Private Custom Lineup v2 completion display unavailable.',
    );
  });
});
