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
