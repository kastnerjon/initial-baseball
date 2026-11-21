import 'server-only';
import { normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import type { DailyPublicPuzzle } from '@initial-baseball/shared';
import type { DailyProgressionTokenCodec } from './dailyProgressionToken';
import type { OfficialDailyCompetitiveProof } from './officialDailyCompetitiveProof';

/** Authenticated proof only; publication lookup must be trusted and exact-ID. */
export function verifyOfficialDailyCompetitiveTranscript(
  proof: OfficialDailyCompetitiveProof,
  tokens: DailyProgressionTokenCodec,
  puzzle: DailyPublicPuzzle,
  expectedPuzzleId: string,
) {
  const fail = () => { throw new Error('Invalid official Daily transcript.'); };
  if (proof.puzzleId !== expectedPuzzleId) return fail();
  const claims = tokens.verify(proof.progressionToken);
  if (claims.puzzleId !== proof.puzzleId || claims.puzzleDate !== proof.puzzleDate
    || claims.rulesetVersion !== proof.rulesetVersion || puzzle.status !== 'published'
    || puzzle.id !== proof.puzzleId || puzzle.puzzleDate !== proof.puzzleDate
    || puzzle.pitches.length !== 9
    || puzzle.pitches.some((pitch, i) => pitch.pitchNumber !== i + 1)) return fail();
  if ((!claims.completed && claims.pitchNumber !== proof.atBats.length + 1)
    || (claims.completed && (claims.pitchNumber !== 9 || proof.atBats.length !== 9))
    || claims.outCount !== Math.min(3, proof.atBats.filter(fact => fact.outcome === 'K').length)) return fail();
  for (const [i, fact] of proof.atBats.entries()) {
    if (!normalizeDailyTerminalAtBat(fact, puzzle.pitches[i]).ok) return fail();
  }
  return claims;
}
