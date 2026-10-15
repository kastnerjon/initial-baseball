import 'server-only';
import { randomUUID } from 'node:crypto';
import { validateCustomLineupPuzzleId } from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CustomNineAttemptRepositoryError, decodeCustomLineupV2AttemptRow,
  requireCustomNineProgressionToken, type CustomNineAttemptState,
} from './customNineAttemptRowCodec';

const TABLE = 'custom_nine_attempt_states';
const COLUMNS = [
  'challenge_id', 'browser_key_digest', 'attempt_id', 'revision',
  'current_progression_token', 'terminal_at_bats', 'status',
  'created_at', 'updated_at', 'completed_at',
].join(',');

export type CustomLineupV2ReservationKey = Readonly<{ challengeId: string; browserKeyDigest: string }>;

function requireKey(key: CustomLineupV2ReservationKey): void {
  try { validateCustomLineupPuzzleId(key.challengeId); }
  catch { throw invalid(); }
  if (!/^[0-9a-f]{64}$/.test(key.browserKeyDigest)) throw invalid();
}
function invalid() {
  return new CustomNineAttemptRepositoryError('invalid-row', 'Invalid private Custom v2 attempt.');
}
function failure() {
  return new CustomNineAttemptRepositoryError('query', 'Private Custom v2 attempt query failed.');
}
async function query<T>(perform: () => PromiseLike<T>): Promise<T> {
  try { return await perform(); } catch { throw failure(); }
}

/** Immutable-N v2 reservation only. No v1 nine-only CAS completion method is exposed. */
export function createSupabaseCustomLineupV2ReservationRepository(
  client: SupabaseClient, immutableAtBatCount: number,
) {
  if (!Number.isInteger(immutableAtBatCount) || immutableAtBatCount < 1 || immutableAtBatCount > 10) {
    throw invalid();
  }
  function decode(row: unknown, key: CustomLineupV2ReservationKey): CustomNineAttemptState {
    const saved = decodeCustomLineupV2AttemptRow(row, immutableAtBatCount);
    if (saved.challengeId !== key.challengeId || saved.browserKeyDigest !== key.browserKeyDigest) {
      throw invalid();
    }
    return saved;
  }
  async function getByKey(key: CustomLineupV2ReservationKey): Promise<CustomNineAttemptState | null> {
    requireKey(key);
    const result = await query(() => client.from(TABLE).select(COLUMNS)
      .eq('challenge_id', key.challengeId)
      .eq('browser_key_digest', key.browserKeyDigest).maybeSingle());
    if (result.error !== null) throw failure();
    return result.data === null ? null : decode(result.data, key);
  }
  return {
    getByKey,
    /** Hint-only CAS: no terminal facts, status or completed timestamp changes. */
    async advanceHint(expected: CustomNineAttemptState, successorToken: string): Promise<
      | { status: 'advanced'; state: CustomNineAttemptState }
      | { status: 'conflict' }
    > {
      const prior = decode({
        challenge_id: expected.challengeId, browser_key_digest: expected.browserKeyDigest,
        attempt_id: expected.attemptId, revision: expected.revision,
        current_progression_token: expected.currentProgressionToken,
        terminal_at_bats: expected.terminalAtBats, status: expected.status,
        created_at: expected.createdAt, updated_at: expected.updatedAt,
        completed_at: expected.completedAt,
      }, { challengeId: expected.challengeId, browserKeyDigest: expected.browserKeyDigest });
      if (prior.status !== 'active' || prior.revision >= Number.MAX_SAFE_INTEGER) throw invalid();
      requireCustomNineProgressionToken(successorToken);
      if (successorToken === prior.currentProgressionToken) throw invalid();
      const result = await query(() => client.from(TABLE).update({
        revision: prior.revision + 1,
        current_progression_token: successorToken,
        updated_at: new Date().toISOString(),
      }).eq('challenge_id', prior.challengeId)
        .eq('browser_key_digest', prior.browserKeyDigest)
        .eq('attempt_id', prior.attemptId)
        .eq('revision', prior.revision)
        .eq('current_progression_token', prior.currentProgressionToken)
        .eq('status', 'active').select(COLUMNS).maybeSingle());
      if (result.error !== null) throw failure();
      if (result.data === null) return { status: 'conflict' };
      const next = decode(result.data, prior);
      if (next.attemptId !== prior.attemptId || next.revision !== prior.revision + 1
        || next.currentProgressionToken !== successorToken || next.status !== 'active'
        || next.completedAt !== null
        || JSON.stringify(next.terminalAtBats) !== JSON.stringify(prior.terminalAtBats)) throw invalid();
      return { status: 'advanced', state: next };
    },
    async getOrCreate(key: CustomLineupV2ReservationKey, initialToken: string) {
      requireKey(key);
      requireCustomNineProgressionToken(initialToken);
      const attemptId = randomUUID();
      const result = await query(() => client.from(TABLE).insert({
        challenge_id: key.challengeId, browser_key_digest: key.browserKeyDigest,
        attempt_id: attemptId, revision: 0, current_progression_token: initialToken,
        terminal_at_bats: [], status: 'active', completed_at: null,
      }).select(COLUMNS).single());
      if (result.error !== null) {
        if (result.error.code !== '23505') throw failure();
        const winner = await getByKey(key);
        if (winner === null) throw failure();
        return { status: 'existing' as const, state: winner };
      }
      const inserted = decode(result.data, key);
      if (inserted.attemptId !== attemptId || inserted.revision !== 0
        || inserted.currentProgressionToken !== initialToken
        || inserted.terminalAtBats.length !== 0 || inserted.status !== 'active') throw invalid();
      return { status: 'inserted' as const, state: inserted };
    },
  };
}
