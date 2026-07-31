import { POINTS_V1_DAILY_RULESET_VERSION, type DailyShareResult } from '@initial-baseball/shared';

export function formatDailyShareText(result: DailyShareResult): string {
  const scoreLine = result.rulesetVersion === POINTS_V1_DAILY_RULESET_VERSION
    ? `${result.points.points}/${result.points.maximumPoints} PTS · ${result.summary.strikeouts} K`
    : `${result.summary.runs} R / ${result.summary.hits} H / ${result.summary.outs} OUT`;
  const lines = [
    `Daily Inning #${result.puzzleNumber}`,
    'by Initial Baseball',
    '',
    scoreLine,
    '',
    ...result.pitchLines.map((line) => `${line.initials}: ${line.outcome}`),
    '',
    result.url,
  ];

  return lines.join('\n');
}
