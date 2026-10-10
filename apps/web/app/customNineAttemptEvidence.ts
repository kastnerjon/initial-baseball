import 'server-only';
import { createHash } from 'node:crypto';
import { validateCustomNinePuzzleId } from '@initial-baseball/daily';
import { validateDailyCompletedResult } from '@initial-baseball/engine';
import type { DailyCompletedAtBat, DailyCompletedResult, DailyPublicPuzzle } from '@initial-baseball/shared';
import { createCustomNineTerminalReceiptCodec } from './customNineTerminalReceipt';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import type { DailyProgressionClaims } from './dailyProgressionToken';

/**
 * Validates server-signed terminal observations and the nine-batter path.
 * Does NOT establish a unique attempt, genuine first play, or creator eligibility.
 * Never attach this verifier directly to a public competitive write route.
 */
export function createCustomNineAttemptEvidenceVerifier(secret: string) {
  const receipts = createCustomNineTerminalReceiptCodec(secret);
  const tokens = createCustomNineProgressionTokens(secret);
  const digest = (token: string) => createHash('sha256').update(token).digest('base64url');

  function verify(submission: unknown, puzzle: DailyPublicPuzzle): DailyCompletedResult {
    if (!record(submission) || !keys(submission, ['schemaVersion', 'submissionId', 'entries'])
      || submission.schemaVersion !== 1
      || typeof submission.submissionId !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(submission.submissionId)
      || !Array.isArray(submission.entries) || submission.entries.length !== 9) {
      throw new CustomNineAttemptEvidenceError();
    }
    try {
      validateCustomNinePuzzleId(puzzle.id);
      if (puzzle.puzzleDate !== CUSTOM_NINE_SESSION_DATE || puzzle.puzzleNumber !== 1
        || puzzle.pitches.length !== 9
        || puzzle.pitches.some((pitch, i) => pitch.pitchNumber !== i + 1 || !pitch.initials.trim())) {
        throw new CustomNineAttemptEvidenceError();
      }

      const terminalFacts: DailyCompletedAtBat[] = [];
      let prior: DailyProgressionClaims | null = null;
      for (const [index, entry] of submission.entries.entries()) {
        if (!record(entry) || !keys(entry, ['receipt', 'predecessorToken', 'successorToken'])
          || typeof entry.receipt !== 'string' || entry.receipt.length > 2048
          || !validTokenText(entry.predecessorToken) || !validTokenText(entry.successorToken)) {
          throw new CustomNineAttemptEvidenceError();
        }
        const evidence = receipts.verify(entry.receipt);
        const before = tokens.verify(entry.predecessorToken);
        const after = tokens.verify(entry.successorToken);
        if (evidence.puzzleId !== puzzle.id
          || digest(entry.predecessorToken) !== evidence.predecessorDigest
          || digest(entry.successorToken) !== evidence.successorDigest
          || !scoped(before, puzzle.id) || !scoped(after, puzzle.id)
          || before.completed || before.pitchNumber !== index + 1
          || before.outCount !== (prior === null ? 0 : prior.outCount)
          || (prior !== null && (prior.completed || prior.pitchNumber !== index + 1))
          || evidence.atBat.pitchNumber !== index + 1
          || evidence.atBat.initials !== puzzle.pitches[index]?.initials
          || evidence.atBat.hintsRevealed !== before.revealCount
          || evidence.atBat.wrongGuesses !== (
            evidence.atBat.resolution === 'strikeout' ? 3 : before.strikeCount
          )
          || (evidence.atBat.resolution === 'strikeout' && before.strikeCount !== 2)
          || after.pitchNumber !== (index === 8 ? 9 : index + 2)
          || after.completed !== (index === 8)
          || after.revealCount !== 0 || after.strikeCount !== 0
          || after.outCount !== Math.min(3, before.outCount
            + (evidence.atBat.resolution === 'correct' ? 0 : 1))) {
          throw new CustomNineAttemptEvidenceError();
        }
        terminalFacts.push(evidence.atBat);
        prior = after;
      }
      // Recalculate every native points-v4 result from frozen authoritative initials.
      const validation = validateDailyCompletedResult({
        submission: {
          schemaVersion: 1, submissionId: submission.submissionId,
          puzzleId: puzzle.id, puzzleDate: puzzle.puzzleDate,
          puzzleNumber: puzzle.puzzleNumber, rulesetVersion: 'points-v4',
          completedAtBats: terminalFacts,
        },
        puzzle,
        rulesetVersion: 'points-v4',
      });
      if (!validation.ok || validation.result.rulesetVersion !== 'points-v4') {
        throw new CustomNineAttemptEvidenceError();
      }
      return validation.result;
    } catch {
      // Never echo untrusted evidence, private puzzle data, or signing details.
      throw new CustomNineAttemptEvidenceError();
    }
  }
  return { verify };
}

export class CustomNineAttemptEvidenceError extends Error {
  constructor() {
    super('Invalid Custom Nine attempt evidence.');
    this.name = 'CustomNineAttemptEvidenceError';
  }
}

function scoped(claims: DailyProgressionClaims, puzzleId: string): boolean {
  return claims.version === 1 && claims.puzzleId === puzzleId
    && claims.puzzleDate === CUSTOM_NINE_SESSION_DATE
    && claims.rulesetVersion === 'points-v4';
}
function validTokenText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every(k => Object.hasOwn(value, k));
}
