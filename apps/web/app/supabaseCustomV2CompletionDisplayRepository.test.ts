import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import {
  createSupabaseCustomV2CompletionDisplayRepository,
  type CustomV2CompletionDisplayWrite,
} from './supabaseCustomV2CompletionDisplayRepository';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
const INPUT: CustomV2CompletionDisplayWrite = {
  puzzleId: ID, browserKeyDigest: 'a'.repeat(64),
  choice: { mode: 'named', displayName: 'Guest Hero' },
};
function setup(data: unknown = { created: true }, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ single });
  const repository = createSupabaseCustomV2CompletionDisplayRepository(
    { rpc } as unknown as SupabaseClient,
  );
  return { repository, rpc, single };
}

describe('service-only Custom v2 completion display RPC adapter', () => {
  it('passes ONLY server-bound puzzle/digest and parsed named choice', async () => {
    const s = setup();
    expect(await s.repository.write(INPUT)).toBe('created');
    expect(s.rpc).toHaveBeenCalledOnce();
    expect(s.rpc).toHaveBeenCalledWith('record_custom_lineup_v2_completion_display', {
      p_challenge_id: ID, p_browser_key_digest: INPUT.browserKeyDigest,
      p_display_mode: 'named', p_display_name: 'Guest Hero',
    });
    const payload = s.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('submissionId');
    expect(payload).not.toHaveProperty('attemptId');
    expect(payload).not.toHaveProperty('score');
    expect(payload).not.toHaveProperty('creatorAccountId');
  });

  it('stores Anonymous with no retained name, recognizes exact retry and immutable conflicts', async () => {
    const choice: CustomV2CompletionDisplayWrite = {
      ...INPUT, choice: { mode: 'anonymous', displayName: null },
    };
    const existing = setup({ created: false });
    expect(await existing.repository.write(choice)).toBe('existing');
    expect(existing.rpc.mock.calls[0]![1]).toMatchObject({
      p_display_mode: 'anonymous', p_display_name: null,
    });
    const conflict = setup(null, { code: '23505', message: 'PRIVATE_OLD_NAME' });
    expect(await conflict.repository.write(INPUT)).toBe('conflict');
  });

  it('refuses malformed identities, untrimmed/oversized names and invalid choice before RPC', async () => {
    const s = setup();
    for (const bad of [
      { ...INPUT, puzzleId: 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000' },
      { ...INPUT, browserKeyDigest: 'not-a-valid-digest' },
      { ...INPUT, choice: { mode: 'named', displayName: ' Guest Hero ' } },
      { ...INPUT, choice: { mode: 'named', displayName: 'a'.repeat(33) } },
      { ...INPUT, choice: { mode: 'named', displayName: 'Control\nName' } },
      { ...INPUT, choice: { mode: 'anonymous', displayName: 'should-be-null' } },
      { ...INPUT, choice: { mode: 'public', displayName: null } },
    ]) await expect(s.repository.write(bad as CustomV2CompletionDisplayWrite))
      .rejects.toThrow('Private Custom completion display unavailable.');
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it('redacts provider errors and malformed RPC payloads', async () => {
    for (const data of [null, [], { created: 'yes' }, { status: 'saved' }]) {
      await expect(setup(data).repository.write(INPUT))
        .rejects.toThrow('Private Custom completion display unavailable.');
    }
    const rejected = setup(null, { code: '42501', message: 'SERVICE_ROLE_SECRET' });
    await expect(rejected.repository.write(INPUT))
      .rejects.toThrow('Private Custom completion display unavailable.');
    const thrown = setup();
    thrown.single.mockRejectedValueOnce(new Error('PRIVATE_SQL_DETAILS'));
    await expect(thrown.repository.write(INPUT))
      .rejects.toThrow('Private Custom completion display unavailable.');
  });
});
