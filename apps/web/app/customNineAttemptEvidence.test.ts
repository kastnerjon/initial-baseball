import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { DailyPublicPuzzle } from '@initial-baseball/shared';
import { createCustomNineProgressionTokens, CUSTOM_NINE_SESSION_DATE } from './serverCustomNineBootstrap';
import { createCustomNineTerminalReceiptCodec } from './customNineTerminalReceipt';
import { createCustomNineAttemptEvidenceVerifier, CustomNineAttemptEvidenceError } from './customNineAttemptEvidence';

const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const SECRET = 'a-long-configured-progression-secret-for-testing-attempt-verifier';
const codec = createCustomNineTerminalReceiptCodec(SECRET);
const tokens = createCustomNineProgressionTokens(SECRET);
const service = createCustomNineAttemptEvidenceVerifier(SECRET);
const puzzle: DailyPublicPuzzle = {
  id: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE, puzzleNumber: 1,
  status: 'published', hintConfig: [], statsHintConfig: { hitter: [], pitcher: [] },
  pitches: Array.from({ length: 9 }, (_, i) => ({
    pitchNumber: i + 1, initials: 'P' + (i + 1),
  })),
};
type Entry = { receipt: string; predecessorToken: string; successorToken: string };

function build() {
  let outCount = 0;
  const entries: Entry[] = [];
  for (let i = 0; i < 9; i++) {
    const kind = i % 3 === 0 ? 'correct' : i % 3 === 1 ? 'give_up' : 'strikeout';
    const revealCount = (kind === 'correct' ? i % 5 : 0) as 0 | 1 | 2 | 3 | 4;
    const strikeCount = kind === 'strikeout' ? 2 : 0;
    const before = tokens.sign({
      version: 1, rulesetVersion: 'points-v4', puzzleId: ID,
      puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: i + 1,
      revealCount, strikeCount, outCount: outCount as 0 | 1 | 2 | 3,
      completed: false,
    });
    outCount = Math.min(3, outCount + (kind === 'correct' ? 0 : 1));
    const after = tokens.sign({
      version: 1, rulesetVersion: 'points-v4', puzzleId: ID,
      puzzleDate: CUSTOM_NINE_SESSION_DATE, pitchNumber: i === 8 ? 9 : i + 2,
      revealCount: 0, strikeCount: 0, outCount: outCount as 0 | 1 | 2 | 3,
      completed: i === 8,
    });
    const atBat = {
      pitchNumber: i + 1, initials: 'P' + (i + 1),
      outcome: kind === 'correct' ? ['HR', '3B', '2B', '1B', 'BB'][revealCount] : 'K',
      hintsRevealed: revealCount, wrongGuesses: kind === 'strikeout' ? 3 : strikeCount,
      resolution: kind,
    };
    entries.push({
      receipt: codec.sign({ puzzleId: ID, atBat: atBat as Parameters<typeof codec.sign>[0]['atBat'],
        predecessorToken: before, successorToken: after }),
      predecessorToken: before, successorToken: after,
    });
  }
  return { schemaVersion: 1, submissionId: 'attempt_result_one', entries };
}

describe('private Custom Nine nine-at-bat evidence verifier', () => {
  it('validates a signed nine-batter path and recalculates its points from the engine', () => {
    const submission = build();
    const result = service.verify(submission, puzzle);
    expect(result).toMatchObject({
      submissionId: 'attempt_result_one', puzzleId: ID, puzzleDate: CUSTOM_NINE_SESSION_DATE,
      puzzleNumber: 1, rulesetVersion: 'points-v4',
      summary: { completed: true, atBatsCompleted: 9, totalAtBats: 9 },
    });
    expect(result.completedAtBats).toHaveLength(9);
    expect(result.completedAtBats[0]).toMatchObject({
      outcome: 'HR', hintsRevealed: 0, wrongGuesses: 0, resolution: 'correct',
    });
    expect(result).not.toHaveProperty('entries');
    expect(JSON.stringify(result)).not.toContain('receipt');
  });

  it('rejects incomplete, duplicated, reordered, mismatched and cross-challenge receipts', () => {
    const base = build();
    const invalid = [
      { ...base, entries: base.entries.slice(0, 8) },
      { ...base, entries: [...base.entries.slice(0, 8), base.entries[0]] },
      { ...base, entries: [base.entries[1], base.entries[0], ...base.entries.slice(2)] },
      { ...base, entries: base.entries.map((e, i) => i === 2
        ? { ...e, receipt: e.receipt + '=' } : e) },
      { ...base, entries: base.entries.map((e, i) => i === 3
        ? { ...e, predecessorToken: base.entries[2]!.predecessorToken } : e) },
    ];
    for (const input of invalid) {
      expect(() => service.verify(input, puzzle)).toThrow(CustomNineAttemptEvidenceError);
    }
    expect(() => service.verify(base, { ...puzzle, id: OTHER })).toThrow();
    expect(() => service.verify(base, { ...puzzle, pitches: puzzle.pitches.map((p, i) => i === 4
      ? { ...p, initials: 'wrong' } : p) })).toThrow();
    expect(() => service.verify(base, { ...puzzle, puzzleDate: '2026-10-10' })).toThrow();
  });

  it('rejects validly signed but inconsistent strike/out/hint/transition facts', () => {
    const base = build();
    const first = base.entries[0]!;
    const signedFirst = codec.verify(first.receipt);
    const changedHint = {
      ...signedFirst.atBat, hintsRevealed: 1 as const, outcome: '3B' as const,
    };
    const fakeReceipt = codec.sign({ puzzleId: ID, atBat: changedHint,
      predecessorToken: first.predecessorToken, successorToken: first.successorToken });
    expect(() => service.verify({ ...base, entries: [
      { ...first, receipt: fakeReceipt }, ...base.entries.slice(1),
    ] }, puzzle)).toThrow();
    const third = base.entries[2]!;
    const changedStrike = codec.sign({
      puzzleId: ID,
      atBat: { ...codec.verify(third.receipt).atBat, resolution: 'give_up', wrongGuesses: 2 },
      predecessorToken: third.predecessorToken, successorToken: third.successorToken,
    });
    expect(() => service.verify({ ...base, entries: [
      ...base.entries.slice(0, 2), { ...third, receipt: changedStrike }, ...base.entries.slice(3),
    ] }, puzzle)).toThrow();
    const after = tokens.verify(first.successorToken);
    const wrongAfter = tokens.sign({ ...after, outCount: 1 });
    const changedTransition = codec.sign({
      puzzleId: ID, atBat: signedFirst.atBat,
      predecessorToken: first.predecessorToken, successorToken: wrongAfter,
    });
    expect(() => service.verify({ ...base, entries: [
      { ...first, successorToken: wrongAfter, receipt: changedTransition },
      ...base.entries.slice(1),
    ] }, puzzle)).toThrow();
  });

  it('rejects foreign domains, malformed envelopes and untrusted score fields', () => {
    const base = build();
    const bad = [
      { ...base, schemaVersion: 2 },
      { ...base, submissionId: '!' },
      { ...base, points: 9999 },
      { ...base, entries: base.entries.map((e, i) => i === 0
        ? { ...e, awardedPoints: 9999 } : e) },
      null,
    ];
    for (const value of bad) expect(() => service.verify(value, puzzle)).toThrow();
    const otherSecret = 'a-second-very-long-configured-progression-secret-for-testing';
    const alien = createCustomNineProgressionTokens(otherSecret).sign(
      tokens.verify(base.entries[0]!.predecessorToken),
    );
    expect(() => service.verify({ ...base, entries: [
      { ...base.entries[0]!, predecessorToken: alien }, ...base.entries.slice(1),
    ] }, puzzle)).toThrow();
  });

  it('does not claim unique first-play authority: alternate server-signed branches still verify', () => {
    const firstPlay = build();
    const original = firstPlay.entries[0]!;
    const before = tokens.verify(original.predecessorToken);
    const alternateBefore = tokens.sign({ ...before, revealCount: 2 });
    const alternateReceipt = codec.sign({
      puzzleId: ID, atBat: {
        pitchNumber: 1, initials: 'P1', outcome: '2B',
        hintsRevealed: 2, wrongGuesses: 0, resolution: 'correct',
      },
      predecessorToken: alternateBefore,
      successorToken: original.successorToken,
    });
    const branched = {
      ...firstPlay,
      entries: [{
        receipt: alternateReceipt, predecessorToken: alternateBefore,
        successorToken: original.successorToken,
      }, ...firstPlay.entries.slice(1)],
    };
    const first = service.verify(firstPlay, puzzle);
    const second = service.verify(branched, puzzle);
    if (first.rulesetVersion !== 'points-v4' || second.rulesetVersion !== 'points-v4') {
      throw new Error('Expected validated points-v4 results.');
    }
    expect(first.summary.points).not.toBe(second.summary.points);
    // A later write gate MUST add server-monotonic attempt / first-result policy.
  });
});
