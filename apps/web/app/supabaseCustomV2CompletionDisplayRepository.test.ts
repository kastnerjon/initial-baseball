import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));

import { createSupabaseCustomV2CompletionDisplayRepository } from './supabaseCustomV2CompletionDisplayRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const DIGEST = 'a'.repeat(64);
const base = { challengeId: ID, browserKeyDigest: DIGEST } as const;
function setup(data: unknown = { created: true }, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ single });
  return { single, rpc, repo: createSupabaseCustomV2CompletionDisplayRepository(
    { rpc } as unknown as SupabaseClient,
  ) };
}
describe('service-only Custom v2 first-write display RPC port', () => {
  it('persists bounded name without submission ID, score or attempt details', async () => {
    const s = setup();
    expect(await s.repo.record({
      ...base, choice: { mode: 'named', displayName: 'Ada <script>' },
    })).toBe('created');
    expect(s.rpc).toHaveBeenCalledOnce();
    expect(s.rpc).toHaveBeenCalledWith('record_custom_lineup_v2_completion_display', {
      p_challenge_id: ID, p_browser_key_digest: DIGEST,
      p_display_mode: 'named', p_display_name: 'Ada <script>',
    });
    expect(JSON.stringify(s.rpc.mock.calls)).not.toContain('submission_id');
    expect(JSON.stringify(s.rpc.mock.calls)).not.toContain('awarded_points');
    expect(JSON.stringify(s.rpc.mock.calls)).not.toContain('PRIVATE_');
  });
  it('sends no name for Anonymous and recognizes idempotent first choice', async () => {
    const s = setup({ created: false });
    expect(await s.repo.record({ ...base, choice: { mode: 'anonymous', displayName: null } }))
      .toBe('existing');
    expect(s.rpc).toHaveBeenCalledWith('record_custom_lineup_v2_completion_display',
      expect.objectContaining({ p_display_mode: 'anonymous', p_display_name: null }));
  });
  it('fails before database I/O on foreign ID, malformed digest or name', async () => {
    const s = setup();
    for (const value of [
      { ...base, challengeId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000',
        choice: { mode: 'anonymous', displayName: null } },
      { ...base, browserKeyDigest: 'not-a-digest',
        choice: { mode: 'anonymous', displayName: null } },
      { ...base, choice: { mode: 'named', displayName: 'x'.repeat(33) } },
      { ...base, choice: { mode: 'anonymous', displayName: 'bad' } },
    ]) {
      await expect(s.repo.record(value as never)).rejects.toThrow(
        'Private Custom Lineup v2 completion display unavailable.',
      );
    }
    expect(s.rpc).not.toHaveBeenCalled();
  });
  it('rejects malformed/array/empty response, conflict and thrown provider errors', async () => {
    for (const row of [{ created: 'yes' }, { created: true, display_name: 'LEAK' }, [], null]) {
      const s = setup(row);
      await expect(s.repo.record({
        ...base, choice: { mode: 'named', displayName: 'Avi' },
      })).rejects.toThrow('Private Custom Lineup v2 completion display unavailable.');
    }
    const conflict = setup(null, { code: '23505', message: 'PRIVATE_SQL_INTERNALS' });
    await expect(conflict.repo.record({
      ...base, choice: { mode: 'named', displayName: 'Avi' },
    })).rejects.toThrow('Private Custom Lineup v2 completion display unavailable.');
    const crashed = setup();
    crashed.single.mockRejectedValueOnce(new Error('PRIVATE_DB_TOKEN'));
    await expect(crashed.repo.record({
      ...base, choice: { mode: 'anonymous', displayName: null },
    })).rejects.toThrow('Private Custom Lineup v2 completion display unavailable.');
  });
});
