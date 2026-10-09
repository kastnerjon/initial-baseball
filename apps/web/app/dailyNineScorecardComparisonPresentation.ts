import { POINTS_V4_DAILY_RULESET_VERSION, type DailyRulesetVersion, type DailySharePitchLine } from '@initial-baseball/shared';
import { getDailyNineInclusiveAtBatPercentile } from '@initial-baseball/daily/comparison';
import { formatDailyNinePercentileOrdinal } from './formatDailyNinePercentileOrdinal';
import {
  formatDailyScorecardPoints,
  type DailyScorecardPoints,
} from './dailyScorecard';
import { createDailyNineCompletedComparisonPresentation, formatDailyNineCompletedPercentile } from './dailyNineCompletedComparisonPresentation';
import type { DailyNineCompletedComparisonState } from './useDailyNineCompletedComparison';
import { createDailyNineAtBatComparisonState } from './dailyNineAtBatComparisonState';
import type {
  DailyNineScorecardComparisonState,
  DailyNineScorecardComparisons,
} from './useDailyNineScorecardComparisons';

export type DailyNineScorecardRow = {
  pitchNumber: number;
  initials: string;
  outcome: DailySharePitchLine['outcome'];
  score: string;
  average: string;
  beat: string;
};

export function createDailyNineScorecardAtBatAverage(
  state: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (state?.status !== 'success'
    || state.resolvedAtBatCount === 0
    || state.averagePoints === null) return null;

  return state.averagePoints.toFixed(1);
}

/** The same strict-lower, ties-not-beaten comparison as the terminal at-bat UI. */
export function createDailyNineScorecardAtBatBeat(
  ownPoints: number | undefined,
  comparison: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (ownPoints === undefined) return null;
  const state = createDailyNineAtBatComparisonState(comparison, ownPoints);
  return state.status === 'success' && state.strictLowerAtBatRate !== null
    ? `${Math.round(state.strictLowerAtBatRate * 100)}%`
    : null;
}

/** Inclusive v4 ordinal percentile, independent of rounded AVG and strict-lower BEAT. */
export function createDailyNineScorecardAtBatPercentile(
  ownPoints: number | undefined,
  comparison: DailyNineScorecardComparisonState | undefined,
): string | null {
  if (ownPoints === undefined || comparison?.status !== 'success'
    || comparison.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
    || comparison.scoreHistogram === undefined) return null;
  const rate = getDailyNineInclusiveAtBatPercentile({
    rulesetVersion: comparison.rulesetVersion,
    resolvedAtBatCount: comparison.resolvedAtBatCount,
    scoreHistogram: comparison.scoreHistogram,
  }, ownPoints);
  return rate === null ? null : formatDailyNinePercentileOrdinal(Math.round(rate * 100));
}

export function createDailyNineScorecardRows(
  pitchLines: DailySharePitchLine[],
  points: DailyScorecardPoints,
  comparisons: DailyNineScorecardComparisons,
): DailyNineScorecardRow[] {
  return pitchLines.map((line, index) => {
    const pitchNumber = index + 1;
    const awardedPoints = points[pitchNumber];
    const average = createDailyNineScorecardAtBatAverage(comparisons[pitchNumber]);

    return {
      pitchNumber,
      initials: line.initials,
      outcome: line.outcome,
      score: awardedPoints === undefined ? '—' : formatDailyScorecardPoints(awardedPoints),
      average: average ?? '—',
      beat: createDailyNineScorecardAtBatBeat(awardedPoints, comparisons[pitchNumber]) ?? '—',
    };
  });
}

export function createDailyNineScorecardShareText(
  shareText: string,
  totalPoints: number,
  completedComparison: DailyNineCompletedComparisonState,
  pitchLines: DailySharePitchLine[],
  points: DailyScorecardPoints,
  comparisons: DailyNineScorecardComparisons,
  rulesetVersion?: DailyRulesetVersion,
): string {
  const lines = shareText.split('\n');
  const firstBlank = lines.indexOf('');
  if (firstBlank < 0) return shareText;

  const scoreLineIndex = firstBlank + 1;
  const completedPresentation = completedComparison.status === 'idle'
    ? null
    : createDailyNineCompletedComparisonPresentation(completedComparison);
  const completedAverage = completedPresentation?.average === '—' ? null : completedPresentation?.average ?? null;
  const inclusiveV4 = rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION;
  const completedMetric = inclusiveV4
    ? formatDailyNineCompletedPercentile(completedComparison)
    : completedPresentation?.beat ?? null;
  lines[scoreLineIndex] = [
    `${formatDailyScorecardPoints(totalPoints)} PTS`,
    ...(completedAverage === null ? [] : [`AVG ${completedAverage}`]),
    ...(completedMetric === null ? [] : [inclusiveV4 ? `${formatDailyNinePercentileOrdinal(Number(completedMetric))} Percentile` : `BEAT ${completedMetric}`]),
  ].join(' • ');

  const pitchSectionStart = lines.indexOf('', scoreLineIndex + 1) + 1;
  if (pitchSectionStart <= 0) return lines.join('\n');

  const pitchSectionEnd = lines.indexOf('', pitchSectionStart);
  if (pitchSectionEnd < 0) return lines.join('\n');

  const rows = createDailyNineScorecardRows(pitchLines, points, comparisons);
  const displayRows = inclusiveV4 ? rows.map(row => ({
    ...row,
    beat: createDailyNineScorecardAtBatPercentile(points[row.pitchNumber], comparisons[row.pitchNumber]) ?? '—',
  })) : rows;
  lines.splice(
    pitchSectionStart,
    pitchSectionEnd - pitchSectionStart,
    ...formatDailyNineScorecardShareTable(displayRows, inclusiveV4),
  );

  return lines.join('\n');
}

export function formatDailyNineScorecardShareTable(
  rows: DailyNineScorecardRow[],
  inclusiveV4 = false,
): string[] {
  if (rows.length === 0) return [];

  const labelWidth = Math.max(4, ...rows.map(row => row.initials.length + 1));
  const scoreWidth = Math.max('SCORE'.length, ...rows.map(row => row.score.length));
  const averageWidth = Math.max('AVG'.length, ...rows.map(row => row.average.length));
  const metricLabel = inclusiveV4 ? 'Percentile' : 'BEAT %';
  const beatWidth = Math.max(metricLabel.length, ...rows.map(row => row.beat.length));
  const gap = '   ';

  const header = `${''.padEnd(labelWidth)}${gap}${'SCORE'.padStart(scoreWidth)}${gap}${'AVG'.padStart(averageWidth)}${gap}${metricLabel.padStart(beatWidth)}`;
  const body = rows.map(row => (
    `${`${row.initials}:`.padEnd(labelWidth)}${gap}${row.score.padStart(scoreWidth)}${gap}${row.average.padStart(averageWidth)}${gap}${row.beat.padStart(beatWidth)}`
  ));

  return [header, ...body];
}

