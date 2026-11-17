import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';
import type { OfficialDailyAttemptReservation } from './officialDailyAttemptReservation';

const PROOF_PREFIX = 'official-daily-competitive-proof-v1.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OfficialDailyProgressionSnapshot = Readonly<{
  token: string;
  revision: number;
  terminalAtBats: DailyCompletedAtBat[];
  status: 'active' | 'completed';
}>;

export type OfficialDailyProgressionOutcome = Readonly<{
  outcome: 'initialized' | 'advanced' | 'existing' | 'conflict';
  state: OfficialDailyProgressionSnapshot;
}>;

/**
 * Service-role only. The caller must verify the HMAC, released edition, browser
 * credential and engine-observed transition BEFORE passing signed tokens here.
 * This adapter implements one atomic database progression authority, not
 * authentication, reveal delivery, public routing or completed-result writes.
 */
export function createSupabaseOfficialDailyProgressionStore(client: SupabaseClient) {
  function decodeState(
    row: unknown, reservation: OfficialDailyAttemptReservation,
  ): OfficialDailyProgressionSnapshot {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error('Private official Daily progression invalid.');
    }
    const value = row as Record<string, unknown>;
    if (!UUID.test(String(value.attempt_id)) ||
      value.attempt_id !== reservation.attemptId ||
      value.puzzle_id !== reservation.puzzleId ||
      value.browser_key_digest !== reservation.browserKeyDigest ||
      typeof value.started_at !== 'string' ||
      Date.parse(value.started_at) !== Date.parse(reservation.startedAt) ||
      !Number.isFinite(Date.parse(value.started_at)) ||
      typeof value.revision !== 'number' ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > 36 ||
      typeof value.current_progression_token !== 'string' ||
      !value.current_progression_token.startsWith(PROOF_PREFIX) ||
      value.current_progression_token.length > 4096 ||
      !Array.isArray(value.terminal_at_bats) ||
      value.terminal_at_bats.length > 9 ||
      !value.terminal_at_bats.every((fact: unknown, index: number) => validFact(fact, index)) ||
      (value.status !== 'active' && value.status !== 'completed') ||
      (value.status === 'completed') !== (value.terminal_at_bats.length === 9)
    ) {
      throw new Error('Private official Daily progression invalid.');
    }
    return {
      token: value.current_progression_token,
      revision: value.revision,
      terminalAtBats: value.terminal_at_bats as DailyCompletedAtBat[],
      status: value.status,
    };
  }

  async function rpc(
    name: 'initialize_official_daily_progression' | 'advance_official_daily_progression',
    args: Record<string, unknown>,
    reservation: OfficialDailyAttemptReservation,
  ): Promise<OfficialDailyProgressionOutcome> {
    let response;
    try {
      response = await client.rpc(name, args).single();
    } catch {
      throw new Error('Private official Daily progression unavailable.');
    }
    if (response.error !== null) {
      throw new Error('Private official Daily progression unavailable.');
    }
    const row = response.data;
    const state = decodeState(row, reservation);
    const outcome = (row as Record<string, unknown>).outcome;
    if (!['initialized', 'advanced', 'existing', 'conflict'].includes(String(outcome))) {
      throw new Error('Private official Daily progression invalid.');
    }
    return { outcome: outcome as OfficialDailyProgressionOutcome['outcome'], state };
  }

  return {
    /** Read the current winner under service-role only; no browser-readable query. */
    async read(reservation: OfficialDailyAttemptReservation): Promise<OfficialDailyProgressionSnapshot> {
      let response;
      try {
        response = await client.from('official_daily_attempt_states')
          .select('attempt_id,puzzle_id,browser_key_digest,started_at,revision,current_progression_token,terminal_at_bats,status')
          .eq('puzzle_id', reservation.puzzleId)
          .eq('browser_key_digest', reservation.browserKeyDigest)
          .eq('attempt_id', reservation.attemptId).single();
      } catch {
        throw new Error('Private official Daily progression unavailable.');
      }
      if (response.error !== null || response.data === null) {
        throw new Error('Private official Daily progression unavailable.');
      }
      return decodeState(response.data, reservation);
    },

    async initialize(reservation: OfficialDailyAttemptReservation, initialToken: string) {
      const stored = await rpc('initialize_official_daily_progression', {
        p_puzzle_id: reservation.puzzleId,
        p_browser_key_digest: reservation.browserKeyDigest,
        p_attempt_id: reservation.attemptId,
        p_initial_token: initialToken,
      }, reservation);
      if (stored.outcome !== 'initialized' && stored.outcome !== 'existing') {
        throw new Error('Private official Daily progression invalid.');
      }
      if (stored.outcome === 'initialized' && (
        stored.state.token !== initialToken || stored.state.revision !== 0 ||
        stored.state.status !== 'active' || stored.state.terminalAtBats.length !== 0
      )) {
        throw new Error('Private official Daily progression invalid.');
      }
      return stored;
    },

    async advance(input: {
      reservation: OfficialDailyAttemptReservation;
      expectedToken: string;
      nextToken: string;
      terminalAtBats: DailyCompletedAtBat[];
      completed: boolean;
    }) {
      const stored = await rpc('advance_official_daily_progression', {
        p_puzzle_id: input.reservation.puzzleId,
        p_browser_key_digest: input.reservation.browserKeyDigest,
        p_attempt_id: input.reservation.attemptId,
        p_expected_token: input.expectedToken,
        p_next_token: input.nextToken,
        p_terminal_at_bats: input.terminalAtBats,
        p_completed: input.completed,
      }, input.reservation);
      if (stored.outcome === 'initialized' ||
        ((stored.outcome === 'advanced' || stored.outcome === 'existing') &&
         (stored.state.token !== input.nextToken ||
          stored.state.status !== (input.completed ? 'completed' : 'active') ||
          !sameFacts(stored.state.terminalAtBats, input.terminalAtBats)))
      ) {
        throw new Error('Private official Daily progression invalid.');
      }
      return stored;
    },
  };
}

function validFact(candidate: unknown, index: number): boolean {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return false;
  const fact = candidate as Record<string, unknown>;
  return fact.pitchNumber === index + 1 &&
    typeof fact.initials === 'string' && fact.initials.length > 0 && fact.initials.length <= 20 &&
    ['HR', '3B', '2B', '1B', 'BB', 'K'].includes(String(fact.outcome)) &&
    typeof fact.hintsRevealed === 'number' &&
    Number.isInteger(fact.hintsRevealed) && fact.hintsRevealed >= 0 && fact.hintsRevealed <= 4 &&
    typeof fact.wrongGuesses === 'number' &&
    Number.isInteger(fact.wrongGuesses) && fact.wrongGuesses >= 0 && fact.wrongGuesses <= 3 &&
    ['correct', 'strikeout', 'give_up'].includes(String(fact.resolution));
}

function sameFacts(left: DailyCompletedAtBat[], right: DailyCompletedAtBat[]): boolean {
  return left.length === right.length && left.every((fact, index) => {
    const other = right[index];
    return other !== undefined &&
      fact.pitchNumber === other.pitchNumber &&
      fact.initials === other.initials &&
      fact.outcome === other.outcome &&
      fact.hintsRevealed === other.hintsRevealed &&
      fact.wrongGuesses === other.wrongGuesses &&
      fact.resolution === other.resolution;
  });
}
