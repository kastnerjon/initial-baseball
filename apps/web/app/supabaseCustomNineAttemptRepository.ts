import 'server-only';
import { randomUUID } from 'node:crypto';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CustomNineAttemptRepositoryError,
  decodeCustomNineAttemptRow,
  normalizeCustomNineAttemptFacts,
  requireCustomNineAttemptKey,
  requireCustomNineAttemptState,
  requireCustomNineProgressionToken,
  type CustomNineAttemptState,
} from './customNineAttemptRowCodec';

const TABLE = 'custom_nine_attempt_states';
const COLUMNS = [
  'challenge_id', 'browser_key_digest', 'attempt_id', 'revision',
  'current_progression_token', 'terminal_at_bats', 'status',
  'created_at', 'updated_at', 'completed_at',
].join(',');

type Key = Readonly<{ challengeId: string; browserKeyDigest: string }>;
export type CustomNineAttemptAdvance = Readonly<{
  progressionToken: string;
  terminalAtBat?: DailyCompletedAtBat;
}>;

/**
 * Private storage primitive only. Callers must authorize challenge, creator
 * eligibility, cryptographically signed tokens and engine transitions BEFORE
 * calling. Not a result-admission or HTTP service.
 */
export function createSupabaseCustomNineAttemptRepository(client: SupabaseClient) {
  async function getByKey(key: Key): Promise<CustomNineAttemptState | null> {
    requireCustomNineAttemptKey(key.challengeId, key.browserKeyDigest);
    const result = await query(() => client.from(TABLE).select(COLUMNS)
      .eq('challenge_id', key.challengeId)
      .eq('browser_key_digest', key.browserKeyDigest).maybeSingle());
    if (result.error !== null) throw providerError();
    return result.data === null ? null : expectedRow(result.data, key);
  }

  return {
    getByKey,

    /** One insert attempt; a same-browser concurrency loser rereads the PK winner. */
    async getOrCreate(key: Key, initialToken: string): Promise<{
      status: 'inserted' | 'existing';
      state: CustomNineAttemptState;
    }> {
      requireCustomNineAttemptKey(key.challengeId, key.browserKeyDigest);
      requireCustomNineProgressionToken(initialToken);
      const attemptId = randomUUID();
      const result = await query(() => client.from(TABLE).insert({
        challenge_id: key.challengeId, browser_key_digest: key.browserKeyDigest,
        attempt_id: attemptId, revision: 0,
        current_progression_token: initialToken, terminal_at_bats: [],
        status: 'active', completed_at: null,
      }).select(COLUMNS).single());
      if (result.error !== null) {
        if (result.error.code !== '23505') throw providerError();
        const winner = await getByKey(key);
        if (winner === null) throw providerError();
        return { status: 'existing', state: winner };
      }
      const inserted = expectedRow(result.data, key);
      if (inserted.attemptId !== attemptId || inserted.revision !== 0
        || inserted.currentProgressionToken !== initialToken
        || inserted.terminalAtBats.length !== 0 || inserted.status !== 'active') throw invalidRow();
      return { status: 'inserted', state: inserted };
    },

    /** Conditional UPDATE is a single database CAS; zero rows means stale branch. */
    async advance(expected: CustomNineAttemptState, action: CustomNineAttemptAdvance): Promise<
      | { status: 'advanced'; state: CustomNineAttemptState }
      | { status: 'conflict' }
    > {
      const prior = requireCustomNineAttemptState(expected);
      if (prior.status !== 'active' || prior.revision >= Number.MAX_SAFE_INTEGER) throw invalidRow();
      requireCustomNineProgressionToken(action.progressionToken);
      if (action.progressionToken === prior.currentProgressionToken) throw invalidRow();
      const facts: readonly DailyCompletedAtBat[] = action.terminalAtBat === undefined
        ? prior.terminalAtBats
        : normalizeCustomNineAttemptFacts([...prior.terminalAtBats, action.terminalAtBat]);
      const completed = facts.length === 9;
      const now = new Date().toISOString();
      const result = await query(() => client.from(TABLE).update({
        revision: prior.revision + 1,
        current_progression_token: action.progressionToken,
        terminal_at_bats: facts,
        status: completed ? 'completed' : 'active',
        updated_at: now,
        completed_at: completed ? now : null,
      })
        .eq('challenge_id', prior.challengeId)
        .eq('browser_key_digest', prior.browserKeyDigest)
        .eq('attempt_id', prior.attemptId)
        .eq('revision', prior.revision)
        .eq('current_progression_token', prior.currentProgressionToken)
        .eq('status', 'active')
        .select(COLUMNS).maybeSingle());
      if (result.error !== null) throw providerError();
      if (result.data === null) return { status: 'conflict' };
      const next = expectedRow(result.data, prior);
      if (next.attemptId !== prior.attemptId || next.revision !== prior.revision + 1
        || next.currentProgressionToken !== action.progressionToken
        || next.status !== (completed ? 'completed' : 'active')
        || JSON.stringify(next.terminalAtBats) !== JSON.stringify(facts)
        || (completed ? next.completedAt === null : next.completedAt !== null)) throw invalidRow();
      return { status: 'advanced', state: next };
    },
  };
}

function expectedRow(row: unknown, key: Key): CustomNineAttemptState {
  const decoded = decodeCustomNineAttemptRow(row);
  if (decoded.challengeId !== key.challengeId || decoded.browserKeyDigest !== key.browserKeyDigest) {
    throw invalidRow();
  }
  return decoded;
}

async function query<T>(operation: () => PromiseLike<T>): Promise<T> {
  try { return await operation(); }
  catch { throw providerError(); }
}

function providerError(): CustomNineAttemptRepositoryError {
  return new CustomNineAttemptRepositoryError('query', 'Private Custom Nine attempt query failed.');
}
function invalidRow(): CustomNineAttemptRepositoryError {
  return new CustomNineAttemptRepositoryError('invalid-row', 'Invalid private Custom Nine attempt state.');
}
