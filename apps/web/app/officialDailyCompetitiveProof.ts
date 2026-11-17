import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';

/** An authenticated transcript is evidence of origin, not replay protection. */
export type OfficialDailyCompetitiveProof = {
  version: 1;
  purpose: 'live';
  attemptId: string;
  puzzleId: string;
  puzzleDate: string;
  rulesetVersion: 'points-v4';
  startedAt: number;
  progressionToken: string;
  atBats: DailyCompletedAtBat[];
};

const PREFIX = 'official-daily-competitive-proof-v1';
const ID = /^daily-ed-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class OfficialDailyCompetitiveProofError extends Error {}

/**
 * Domain separated from v1 progression tokens. Only server-observed facts
 * may be signed. The admission layer must also enforce a live-start window,
 * atomic first-write/idempotence, and the authoritative publication identity.
 */
export function createOfficialDailyCompetitiveProofCodec(secret: string) {
  if (secret.length < 32) throw new Error('Competitive proof secret must be at least 32 characters.');
  const mac = (input: string) => createHmac('sha256', secret).update(input).digest();
  return {
    sign(value: OfficialDailyCompetitiveProof): string {
      const proof = parseProof(value);
      const payload = Buffer.from(JSON.stringify(proof), 'utf8').toString('base64url');
      const signed = `${PREFIX}.${payload}`;
      return `${signed}.${mac(signed).toString('base64url')}`;
    },
    verify(token: string): OfficialDailyCompetitiveProof {
      if (typeof token !== 'string' || token.length > 16384) throw invalid();
      const parts = token.split('.');
      if (parts.length !== 3 || parts[0] !== PREFIX || !canonical(parts[1]) || !canonical(parts[2])) throw invalid();
      const actual = Buffer.from(parts[2]!, 'base64url');
      const expected = mac(`${PREFIX}.${parts[1]}`);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
      try {
        return parseProof(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as unknown);
      } catch {
        throw invalid();
      }
    },
  };
}

function parseProof(value: unknown): OfficialDailyCompetitiveProof {
  if (!record(value) || value.version !== 1 || value.purpose !== 'live'
    || typeof value.attemptId !== 'string' || !UUID.test(value.attemptId)
    || typeof value.puzzleId !== 'string' || !ID.test(value.puzzleId)
    || typeof value.puzzleDate !== 'string' || !validDate(value.puzzleDate)
    || value.rulesetVersion !== 'points-v4' || !Number.isSafeInteger(value.startedAt)
    || (value.startedAt as number) < 0 || typeof value.progressionToken !== 'string'
    || value.progressionToken.length === 0 || value.progressionToken.length > 4096
    || !Array.isArray(value.atBats) || value.atBats.length > 9) throw invalid();
  const atBats = value.atBats.map((fact, i) => parseAtBat(fact, i + 1));
  return { version: 1, purpose: 'live', attemptId: value.attemptId, puzzleId: value.puzzleId,
    puzzleDate: value.puzzleDate, rulesetVersion: 'points-v4', startedAt: value.startedAt as number,
    progressionToken: value.progressionToken, atBats };
}

function parseAtBat(value: unknown, pitchNumber: number): DailyCompletedAtBat {
  if (!record(value) || value.pitchNumber !== pitchNumber || typeof value.initials !== 'string'
    || value.initials.length < 1 || value.initials.length > 20
    || !['HR', '3B', '2B', '1B', 'BB', 'K'].includes(value.outcome as string)
    || !Number.isInteger(value.hintsRevealed) || (value.hintsRevealed as number) < 0
    || (value.hintsRevealed as number) > 4 || !Number.isInteger(value.wrongGuesses)
    || (value.wrongGuesses as number) < 0 || (value.wrongGuesses as number) > 3
    || !['correct', 'strikeout', 'give_up'].includes(value.resolution as string)) throw invalid();
  return { pitchNumber, initials: value.initials, outcome: value.outcome as DailyCompletedAtBat['outcome'],
    hintsRevealed: value.hintsRevealed as DailyCompletedAtBat['hintsRevealed'],
    wrongGuesses: value.wrongGuesses as number, resolution: value.resolution as DailyCompletedAtBat['resolution'] };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function canonical(value: string | undefined): value is string {
  return !!value && /^[A-Za-z0-9_-]+$/.test(value)
    && Buffer.from(value, 'base64url').toString('base64url') === value;
}
function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function invalid(): OfficialDailyCompetitiveProofError {
  return new OfficialDailyCompetitiveProofError('Invalid official Daily competitive proof.');
}
