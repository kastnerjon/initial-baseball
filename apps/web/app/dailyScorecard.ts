import { getDailyAtBatPoints } from '@initial-baseball/engine';
import {
  isDailyPointsRulesetVersion,
  type DailyCompletedAtBat,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';

/** Browser-local terminal reveals. Never pass this record into public share output. */
export type DailyScorecardAnswers = Record<number, string>;

export type DailyScorecardPoints = Record<number, number>;

export function createDailyScorecardPoints(
  completedAtBats: DailyCompletedAtBat[],
  rulesetVersion: DailyRulesetVersion,
): DailyScorecardPoints {
  if (!isDailyPointsRulesetVersion(rulesetVersion)) return {};

  return completedAtBats.reduce<DailyScorecardPoints>((points, atBat) => {
    points[atBat.pitchNumber] = getDailyAtBatPoints({
      rulesetVersion,
      outcome: atBat.outcome,
      hintsRevealed: atBat.hintsRevealed,
      wrongGuesses: atBat.wrongGuesses,
    });
    return points;
  }, {});
}

export function formatDailyScorecardPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

export function restoreDailyScorecardAnswers(
  value: unknown,
  resolvedPitchNumbers: number[],
): DailyScorecardAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const answers: DailyScorecardAnswers = {};
  for (const pitchNumber of resolvedPitchNumbers) {
    const name = record[pitchNumber];
    if (typeof name === 'string' && name.trim().length > 0 && name.length <= 200) {
      answers[pitchNumber] = name;
    }
  }
  return answers;
}
