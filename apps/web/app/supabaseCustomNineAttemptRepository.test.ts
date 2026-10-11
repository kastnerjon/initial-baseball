import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

import {
  decodeCustomNineAttemptRow,
  normalizeCustomNineAttemptFacts,
  type CustomNineAttemptState,
} from './customNineAttemptRowCodec';
import { createSupabaseCustomNineAttemptRepository } from './supabaseCustomNineAttemptRepository';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const DIGEST = 'a'.repeat(64);
const KEY = { challengeId: ID, browserKeyDigest: DIGEST };
const BASE = 'v1.signed-open-token.hmac';
const NOW = '2026-10-10T12:00:00.000Z';
const FACT = (pitchNumber: number) => ({
  pitchNumber, initials: 'P' + pitchNumber, outcome: 'HR' as const,
  hintsRevealed: 0 as const, wrongGuesses: 0, resolution: 'correct' as const,
});

function makeRow(challengeId = ID, digest = DIGEST): Record<string, unknown> {
  return {
    challenge_id: challengeId, browser_key_digest: digest,
    attempt_id: '123e4567-e89b-42d3-a456-426614174010',
    revision: 0, current_progression_token: BASE,
    terminal_at_bats: [], status: 'active', created_at: NOW,
    updated_at: NOW, completed_at: null,
  };
}
type Reply = { data: Record<string, unknown> | null; error: { code: string; message?: string } | null };
const copied = (value: Record<string, unknown>) => structuredClone(value);
function fakeDatabase() {
  const records = new Map<string, Record<string, unknown>>();
  const from = vi.fn((table: string) => {
    if (table !== 'custom_nine_attempt_states') throw new Error('wrong table');
    return {
      insert: (row: Record<string, unknown>) => ({
        select: (_: string) => ({
          single: async (): Promise<Reply> => {
            const id = String(row.challenge_id) + ':' + String(row.browser_key_digest);
            if (records.has(id)) return { data: null, error: { code: '23505' } };
            const stored = {
              ...copied(row), created_at: NOW, updated_at: NOW,
            };
            records.set(id, stored);
            return { data: copied(stored), error: null };
          },
        }),
      }),
      select: (_: string) => {
        const eqs: Record<string, unknown> = {};
        const chain = {
          eq: (name: string, value: unknown) => {
            eqs[name] = value;
            return chain;
          },
          maybeSingle: async (): Promise<Reply> => {
            const match = [...records.values()].find(row =>
              Object.entries(eqs).every(([key, value]) => row[key] === value));
            return { data: match ? copied(match) : null, error: null };
          },
        };
        return chain;
      },
      update: (change: Record<string, unknown>) => {
        const eqs: Record<string, unknown> = {};
        const chain = {
          eq: (name: string, value: unknown) => {
            eqs[name] = value;
            return chain;
          },
          select: (_: string) => ({
            maybeSingle: async (): Promise<Reply> => {
              const match = [...records.values()].find(row =>
                Object.entries(eqs).every(([key, value]) => row[key] === value));
              if (!match) return { data: null, error: null };
              Object.assign(match, copied(change));
              return { data: copied(match), error: null };
            },
          }),
        };
        return chain;
      },
    };
  });
  return { client: { from } as unknown as SupabaseClient, records, from };
}

describe('Custom Nine private attempt row codec', () => {
  it('accepts only exact challenge keys, ordered terminal facts, and valid phases', () => {
    const row = makeRow();
    expect(decodeCustomNineAttemptRow(row)).toMatchObject({
      challengeId: ID, browserKeyDigest: DIGEST, revision: 0, status: 'active', terminalAtBats: [],
    });
    for (const bad of [
      { challenge_id: OTHER.slice(0, -1) + '_' },
      { browser_key_digest: 'b'.repeat(63) },
      { attempt_id: 'client_can_choose_this' },
      { revision: 1.5 },
      { revision: -1 },
      { current_progression_token: '' },
      { terminal_at_bats: [FACT(2)] },
      { terminal_at_bats: [FACT(1), FACT(1)] },
      { terminal_at_bats: [FACT(1), { ...FACT(2), outcome: 'BB' }] },
      { terminal_at_bats: [FACT(1), { ...FACT(2), playerId: 'secret' }] },
      { status: 'completed', completed_at: NOW },
      { status: 'active', completed_at: NOW },
      { created_at: 'not a date' },
      { terminal_at_bats: Array.from({ length: 10 }, (_, i) => FACT(i + 1)) },
    ]) expect(() => decodeCustomNineAttemptRow({ ...row, ...bad })).toThrow();
    expect(() => normalizeCustomNineAttemptFacts([FACT(1), FACT(2)])).not.toThrow();
  });
});

describe('Custom Nine private first-attempt repository', () => {
  it('atomically inserts the first winner; concurrent same-key creates resume it', async () => {
    const db = fakeDatabase();
    const repo = createSupabaseCustomNineAttemptRepository(db.client);
    const [first, second] = await Promise.all([
      repo.getOrCreate(KEY, BASE), repo.getOrCreate(KEY, 'v1.alternate-signed-token.hmac'),
    ]);
    expect(first.status).toBe('inserted');
    expect(second.status).toBe('existing');
    expect(first.state.attemptId).toBe(second.state.attemptId);
    expect(first.state.currentProgressionToken).toBe(BASE);
    expect(second.state.currentProgressionToken).toBe(BASE);
    expect(await repo.getByKey(KEY)).toEqual(first.state);
    expect(db.records.size).toBe(1);
    expect(db.from.mock.calls.every(([table]) => table === 'custom_nine_attempt_states')).toBe(true);
    const another = await repo.getOrCreate({ challengeId: OTHER, browserKeyDigest: DIGEST }, BASE);
    expect(another.status).toBe('inserted');
    expect(another.state.attemptId).not.toBe(first.state.attemptId);
  });

  it('performs an exact-token, exact-revision, active-only database CAS', async () => {
    const db = fakeDatabase();
    const repo = createSupabaseCustomNineAttemptRepository(db.client);
    const initial = (await repo.getOrCreate(KEY, BASE)).state;
    const results = await Promise.all([
      repo.advance(initial, { progressionToken: 'v1.branch-a.hmac' }),
      repo.advance(initial, { progressionToken: 'v1.branch-b.hmac' }),
    ]);
    expect(results.filter(x => x.status === 'advanced')).toHaveLength(1);
    expect(results.filter(x => x.status === 'conflict')).toHaveLength(1);
    const saved = await repo.getByKey(KEY);
    expect(saved?.revision).toBe(1);
    expect(saved?.currentProgressionToken).toBe('v1.branch-a.hmac');
    expect(saved?.terminalAtBats).toEqual([]);
    expect(await repo.advance(initial, { progressionToken: 'v1.replay.hmac' }))
      .toEqual({ status: 'conflict' });
    expect(await repo.advance({ ...saved!, currentProgressionToken: BASE }, {
      progressionToken: 'v1.forged.hmac',
    })).toEqual({ status: 'conflict' });
  });

  it('appends ordered terminal facts and makes ninth-batter completion immutable', async () => {
    const repo = createSupabaseCustomNineAttemptRepository(fakeDatabase().client);
    let state = (await repo.getOrCreate(KEY, BASE)).state;
    for (let number = 1; number <= 9; number++) {
      const result = await repo.advance(state, {
        progressionToken: 'signed-successor-' + number,
        terminalAtBat: FACT(number),
      });
      expect(result.status).toBe('advanced');
      if (result.status !== 'advanced') throw Error('Expected committed terminal fact');
      state = result.state;
      expect(state.revision).toBe(number);
      expect(state.terminalAtBats).toHaveLength(number);
    }
    expect(state.status).toBe('completed');
    expect(state.completedAt).not.toBeNull();
    await expect(repo.advance(state, { progressionToken: 'signed-after-finish' }))
      .rejects.toMatchObject({ kind: 'invalid-row' });
    const same = await repo.getOrCreate(KEY, BASE);
    expect(same).toMatchObject({ status: 'existing', state: { status: 'completed', revision: 9 } });
  });

  it('rejects invalid state and terminal additions before a provider call', async () => {
    const db = fakeDatabase();
    const repo = createSupabaseCustomNineAttemptRepository(db.client);
    await expect(repo.getOrCreate({ challengeId: 'daily', browserKeyDigest: DIGEST }, BASE))
      .rejects.toMatchObject({ kind: 'invalid-row' });
    await expect(repo.getOrCreate(KEY, '')).rejects.toMatchObject({ kind: 'invalid-row' });
    expect(db.from).not.toHaveBeenCalled();
    const state = (await repo.getOrCreate(KEY, BASE)).state;
    db.from.mockClear();
    await expect(repo.advance(state, { progressionToken: BASE }))
      .rejects.toMatchObject({ kind: 'invalid-row' });
    await expect(repo.advance(state, { progressionToken: 'signed-next', terminalAtBat: FACT(2) }))
      .rejects.toMatchObject({ kind: 'invalid-row' });
    await expect(repo.advance({ ...state, revision: -1 } as CustomNineAttemptState, {
      progressionToken: 'signed-next',
    })).rejects.toMatchObject({ kind: 'invalid-row' });
    expect(db.from).not.toHaveBeenCalled();
  });

  it('fails closed for wrong PK/attempt returned, unique-conflict-without-winner and provider faults', async () => {
    const db = fakeDatabase();
    const from = vi.fn().mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({
        data: null, error: { code: '23505', message: 'private' },
      }) }) }),
      select: () => {
        const chain = {
          eq: () => chain, maybeSingle: async () => ({ data: null, error: null }),
        };
        return chain;
      },
    });
    await expect(createSupabaseCustomNineAttemptRepository(
      { from } as unknown as SupabaseClient,
    ).getOrCreate(KEY, BASE)).rejects.toMatchObject({ kind: 'query' });

    const repo = createSupabaseCustomNineAttemptRepository(db.client);
    const state = (await repo.getOrCreate(KEY, BASE)).state;
    const wrong = { ...state, attemptId: '123e4567-e89b-42d3-a456-426614174099' };
    expect(await repo.advance(wrong, { progressionToken: 'signed-next' }))
      .toEqual({ status: 'conflict' });
    const corrupt = vi.fn().mockReturnValue({
      select: () => {
        const chain = {
          eq: () => chain, maybeSingle: async () => ({
            data: { ...makeRow(), challenge_id: OTHER }, error: null,
          }),
        };
        return chain;
      },
    });
    await expect(createSupabaseCustomNineAttemptRepository(
      { from: corrupt } as unknown as SupabaseClient,
    ).getByKey(KEY)).rejects.toMatchObject({ kind: 'invalid-row' });
    const broken = vi.fn().mockImplementation(() => { throw Error('PRIVATE_DATABASE_DETAILS'); });
    await expect(createSupabaseCustomNineAttemptRepository(
      { from: broken } as unknown as SupabaseClient,
    ).getByKey(KEY)).rejects.toMatchObject({
      kind: 'query', message: expect.not.stringContaining('PRIVATE_DATABASE_DETAILS'),
    });
  });
});
