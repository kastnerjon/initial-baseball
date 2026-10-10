import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';
import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyCompletedAtBat } from '@initial-baseball/shared';

const DOMAIN = 'initial-baseball:custom-nine:terminal-receipt:v1';
type Evidence = Readonly<{
  puzzleId: string;
  atBat: DailyCompletedAtBat;
  predecessorDigest: string;
  successorDigest: string;
}>;

export function createCustomNineTerminalReceiptCodec(secret: string) {
  if (secret.trim().length < 32) throw new Error('Custom receipt signing unavailable.');
  const key = createHmac('sha256', secret).update(DOMAIN).digest();
  const signature = (input: string) => createHmac('sha256', key).update(input).digest('base64url');
  const digest = (input: string) => createHash('sha256').update(input).digest('base64url');

  return {
    sign(input: { puzzleId: string; atBat: DailyCompletedAtBat;
      predecessorToken: string; successorToken: string }): string {
      validateCustomNinePuzzleId(input.puzzleId);
      if (!validFact(input.atBat)) throw new Error('Invalid Custom terminal fact.');
      const data = {
        version: 1, puzzleId: input.puzzleId,
        atBat: {
          pitchNumber: input.atBat.pitchNumber, initials: input.atBat.initials,
          outcome: input.atBat.outcome, hintsRevealed: input.atBat.hintsRevealed,
          wrongGuesses: input.atBat.wrongGuesses, resolution: input.atBat.resolution,
        },
        predecessorDigest: digest(input.predecessorToken),
        successorDigest: digest(input.successorToken),
      };
      const head = 'cnr1.' + Buffer.from(JSON.stringify(data)).toString('base64url');
      return head + '.' + signature(head);
    },
    verify(receipt: unknown): Evidence {
      if (typeof receipt !== 'string' || receipt.length > 2048) throw new Error('Invalid Custom receipt.');
      const parts = receipt.split('.');
      if (parts.length !== 3 || parts[0] !== 'cnr1' || !parts[1] || !parts[2]
        || !canonical(parts[1]) || !canonical(parts[2])) throw new Error('Invalid Custom receipt.');
      const expected = Buffer.from(signature('cnr1.' + parts[1]), 'base64url');
      const actual = Buffer.from(parts[2], 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new Error('Invalid Custom receipt.');
      }
      let value: unknown;
      try { value = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); }
      catch { throw new Error('Invalid Custom receipt.'); }
      if (!record(value) || value.version !== 1 || typeof value.puzzleId !== 'string'
        || !validFact(value.atBat) || !validDigest(value.predecessorDigest)
        || !validDigest(value.successorDigest)) throw new Error('Invalid Custom receipt.');
      try { validateCustomNinePuzzleId(value.puzzleId); }
      catch { throw new Error('Invalid Custom receipt.'); }
      return {
        puzzleId: value.puzzleId, atBat: value.atBat,
        predecessorDigest: value.predecessorDigest, successorDigest: value.successorDigest,
      };
    },
  };
}
function canonical(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value)
    && Buffer.from(value, 'base64url').toString('base64url') === value;
}
function validDigest(value: unknown): value is string {
  return typeof value === 'string' && value.length === 43 && canonical(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validFact(value: unknown): value is DailyCompletedAtBat {
  if (!record(value) || !Number.isInteger(value.pitchNumber)
    || (value.pitchNumber as number) < 1 || (value.pitchNumber as number) > 9
    || typeof value.initials !== 'string' || !value.initials.trim()
    || value.initials.length > 40) return false;
  return normalizeDailyTerminalAtBat(value, {
    pitchNumber: value.pitchNumber as number,
    initials: value.initials,
  }).ok;
}
