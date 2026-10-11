import { validateCustomNinePuzzleId } from '@initial-baseball/daily';
import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat, DailyPublicPuzzle } from '@initial-baseball/shared';

export type CustomNineAttemptState = Readonly<{
  challengeId: string;
  browserKeyDigest: string;
  attemptId: string;
  revision: number;
  currentProgressionToken: string;
  terminalAtBats: readonly DailyCompletedAtBat[];
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}>;

export class CustomNineAttemptRepositoryError extends Error {
  constructor(public readonly kind: 'invalid-row' | 'query', message: string) {
    super(message);
    this.name = 'CustomNineAttemptRepositoryError';
  }
}

export function requireCustomNineAttemptKey(challengeId: string, digest: string): void {
  try { validateCustomNinePuzzleId(challengeId); }
  catch { throw invalid(); }
  if (!/^[0-9a-f]{64}$/.test(digest)) throw invalid();
}

export function requireCustomNineProgressionToken(value: unknown): asserts value is string {
  if (typeof value !== 'string' || Buffer.byteLength(value) < 1 || Buffer.byteLength(value) > 4096) {
    throw invalid();
  }
}

export function normalizeCustomNineAttemptFacts(value: unknown): readonly DailyCompletedAtBat[] {
  if (!Array.isArray(value) || value.length > 9) throw invalid();
  return value.map((fact: unknown, index: number) => {
    if (!record(fact) || typeof fact.initials !== 'string'
      || fact.initials.trim().length === 0 || fact.initials.length > 40
      || Object.keys(fact).length !== 6
      || !['pitchNumber', 'initials', 'outcome', 'hintsRevealed', 'wrongGuesses', 'resolution']
        .every(key => Object.hasOwn(fact, key))) throw invalid();
    const normalized = normalizeDailyTerminalAtBat(fact, {
      pitchNumber: index + 1, initials: fact.initials,
    } as DailyPublicPuzzle['pitches'][number]);
    if (!normalized.ok) throw invalid();
    return normalized.atBat;
  });
}

/** Decode only private PostgREST rows. Never serialize this into a browser response. */
export function decodeCustomNineAttemptRow(raw: unknown): CustomNineAttemptState {
  if (!record(raw)) throw invalid();
  const challengeId = raw.challenge_id;
  const digest = raw.browser_key_digest;
  if (typeof challengeId !== 'string' || typeof digest !== 'string') throw invalid();
  requireCustomNineAttemptKey(challengeId, digest);
  if (typeof raw.attempt_id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw.attempt_id)
    || typeof raw.revision !== 'number' || !Number.isSafeInteger(raw.revision)
    || raw.revision < 0) throw invalid();
  requireCustomNineProgressionToken(raw.current_progression_token);
  const facts = normalizeCustomNineAttemptFacts(raw.terminal_at_bats);
  if (raw.revision < facts.length
    || (raw.status !== 'active' && raw.status !== 'completed')
    || (raw.status === 'active' && (facts.length === 9 || raw.completed_at !== null))
    || (raw.status === 'completed' && (facts.length !== 9 || !timestamp(raw.completed_at)))
    || !timestamp(raw.created_at) || !timestamp(raw.updated_at)) throw invalid();
  return {
    challengeId, browserKeyDigest: digest, attemptId: raw.attempt_id,
    revision: raw.revision, currentProgressionToken: raw.current_progression_token,
    terminalAtBats: facts, status: raw.status,
    createdAt: raw.created_at, updatedAt: raw.updated_at, completedAt: raw.completed_at,
  };
}

export function requireCustomNineAttemptState(state: CustomNineAttemptState): CustomNineAttemptState {
  return decodeCustomNineAttemptRow({
    challenge_id: state.challengeId,
    browser_key_digest: state.browserKeyDigest,
    attempt_id: state.attemptId,
    revision: state.revision,
    current_progression_token: state.currentProgressionToken,
    terminal_at_bats: state.terminalAtBats,
    status: state.status,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
    completed_at: state.completedAt,
  });
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(): CustomNineAttemptRepositoryError {
  return new CustomNineAttemptRepositoryError('invalid-row', 'Invalid private Custom Nine attempt state.');
}
