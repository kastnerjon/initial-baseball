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


const ATTEMPT = '123e4567-e89b-42d3-a456-426614174010';
function setupRead(
  attemptData: unknown = { attempt_id: ATTEMPT, status: 'completed', creator_seen: false },
  displayData: unknown = { display_mode: 'named', display_name: 'Guest Hero' },
  attemptError: unknown = null,
  displayError: unknown = null,
) {
  const makeQuery = (data: unknown, error: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });
  const attempt = makeQuery(attemptData, attemptError);
  const display = makeQuery(displayData, displayError);
  const from = vi.fn((table: string) => table === 'custom_nine_attempt_states'
    ? attempt : display);
  const repository = createSupabaseCustomV2CompletionDisplayRepository(
    { from } as unknown as SupabaseClient,
  );
  return { from, attempt, display, repository };
}

describe('private Custom v2 display refresh readback', () => {
  const auth = { puzzleId: ID, browserKeyDigest: INPUT.browserKeyDigest };

  it('first resolves the private first attempt and then selects only its matching projection', async () => {
    const s = setupRead();
    expect(await s.repository.read(auth)).toEqual({
      mode: 'named', displayName: 'Guest Hero',
    });
    expect(s.from.mock.calls.map(c => c[0])).toEqual([
      'custom_nine_attempt_states', 'custom_lineup_v2_completion_displays',
    ]);
    expect(s.attempt.select).toHaveBeenCalledWith('attempt_id,status,creator_seen');
    expect(s.attempt.eq).toHaveBeenCalledWith('challenge_id', ID);
    expect(s.attempt.eq).toHaveBeenCalledWith('browser_key_digest', INPUT.browserKeyDigest);
    expect(s.display.select).toHaveBeenCalledWith('display_mode,display_name');
    expect(s.display.eq).toHaveBeenCalledWith('submission_id', ATTEMPT);
    expect(JSON.stringify(await s.repository.read(auth))).not.toContain(ATTEMPT);
  });

  it('returns Anonymous without any display name or score/attempt identity', async () => {
    const s = setupRead(undefined, { display_mode: 'anonymous', display_name: null });
    expect(await s.repository.read(auth)).toEqual({
      mode: 'anonymous', displayName: null,
    });
  });

  it('returns no choice when unfinished, creator-excluded, missing attempt or not yet named', async () => {
    for (const attempt of [
      null,
      { attempt_id: ATTEMPT, status: 'active', creator_seen: false },
      { attempt_id: ATTEMPT, status: 'completed', creator_seen: true },
    ]) {
      const s = setupRead(attempt);
      expect(await s.repository.read(auth)).toBeNull();
      expect(s.from).toHaveBeenCalledTimes(1);
    }
    const unnamed = setupRead(undefined, null);
    expect(await unnamed.repository.read(auth)).toBeNull();
    expect(unnamed.from).toHaveBeenCalledTimes(2);
  });

  it('denies malformed IDs, role/status ambiguity, invalid display rows and provider errors', async () => {
    const s = setupRead();
    for (const input of [
      { ...auth, puzzleId: 'invalid' },
      { ...auth, browserKeyDigest: 'wrong' },
    ]) await expect(s.repository.read(input))
      .rejects.toThrow('Private Custom completion display unavailable.');
    expect(s.from).not.toHaveBeenCalled();

    for (const attempt of [
      { attempt_id: ATTEMPT, status: 'completed', creator_seen: null },
      { attempt_id: 'browser-selected-id', status: 'completed', creator_seen: false },
    ]) await expect(setupRead(attempt).repository.read(auth))
      .rejects.toThrow('Private Custom completion display unavailable.');

    for (const display of [
      { display_mode: 'anonymous', display_name: 'LEAK' },
      { display_mode: 'named', display_name: ' Guest Hero ' },
      { display_mode: 'named', display_name: '\u0000' },
      { display_mode: 'named', display_name: null },
      { display_mode: 'public', display_name: 'Guest Hero' },
      [],
    ]) await expect(setupRead(undefined, display).repository.read(auth))
      .rejects.toThrow('Private Custom completion display unavailable.');

    await expect(setupRead(undefined, undefined, { message: 'SQL_SECRET' })
      .repository.read(auth)).rejects.toThrow('Private Custom completion display unavailable.');
    await expect(setupRead(undefined, undefined, null, { message: 'DB_SECRET' })
      .repository.read(auth)).rejects.toThrow('Private Custom completion display unavailable.');
  });
});
