import { applyDailyOutcomeForRuleset, normalizeDailyTerminalAtBat } from '@initial-baseball/engine';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { createInitialDailyGameState } from './dailyClientState';
import { validateOfficialDailyEditionBootstrap, validateOfficialDailyPublicPuzzle } from './officialDailyEditionHttpTransport';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function invalid(): never { throw new Error('Official Daily scorecard is incompatible.'); }

/** Rebuild display state from server-verified terminal facts under the issued ruleset. */
export function restoreCompetitiveScorecard(value: unknown, puzzleId: string, date: string) {
  if (!record(value) || value.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION ||
      !Number.isSafeInteger(value.revision) || !Array.isArray(value.atBats)) return invalid();
  const { status, atBats } = value;
  const revision = value.revision as number;
  if ((status !== 'active' && status !== 'completed') || atBats.length > 9 ||
      (status === 'completed') !== (atBats.length === 9) ||
      revision < atBats.length || revision > 36) return invalid();
  const fields = ['resolvedNames', 'puzzle', 'rulesetVersion', 'revision', 'atBats', 'status'];
  if (!exact(value, fields.concat(status === 'active'
    ? ['progressionToken', 'strikeCount', 'hintBundle'] : ['summary']))) return invalid();
  const puzzle = validateOfficialDailyPublicPuzzle(value.puzzle, puzzleId, date);
  const names = value.resolvedNames;
  if (!Array.isArray(names) || names.length !== atBats.length ||
      !names.every(name => typeof name === 'string' && name.length > 0 && name.length <= 180)) return invalid();
  const scorecardAnswers: Record<number, string> = Object.fromEntries(names.map((name, i) => [i + 1, name]));
  const rulesetVersion = POINTS_V4_DAILY_RULESET_VERSION;
  let gameState = createInitialDailyGameState(puzzle, rulesetVersion);
  for (const [index, candidate] of atBats.entries()) {
    if (!record(candidate) || !exact(candidate, ['pitchNumber', 'initials', 'outcome',
      'hintsRevealed', 'wrongGuesses', 'resolution'])) return invalid();
    const normalized = normalizeDailyTerminalAtBat(candidate, puzzle.pitches[index]);
    if (!normalized.ok) return invalid();
    const fact = normalized.atBat;
    const next = applyDailyOutcomeForRuleset({ ...gameState, ...fact, totalAtBats: 9, rulesetVersion });
    gameState = { ...gameState, ...next, completedAtBats: [...gameState.completedAtBats, fact],
      completedPitchLines: [...gameState.completedPitchLines, { initials: fact.initials, outcome: fact.outcome }] };
  }
  if (status === 'completed') {
    const expected = { ...gameState.points, strikeouts: gameState.score.strikeouts };
    const summary = value.summary;
    if (!record(summary) || !exact(summary, Object.keys(expected)) ||
        Object.entries(expected).some(([key, item]) => summary[key] !== item)) return invalid();
    return { status: 'completed' as const, scorecardAnswers, gameState: { ...gameState, status: 'completed' as const }, revision };
  }
  if (!Number.isInteger(value.strikeCount) || (value.strikeCount as number) < 0 ||
      (value.strikeCount as number) > 2) return invalid();
  const bootstrap = validateOfficialDailyEditionBootstrap({ puzzle, rulesetVersion,
    progressionToken: value.progressionToken, hintBundle: value.hintBundle }, puzzleId, date, true);
  if (bootstrap.hintBundle.pitchNumber !== atBats.length + 1) return invalid();
  return { status: 'active' as const, scorecardAnswers, gameState, revision, bootstrap, strikeCount: value.strikeCount as number };
}
