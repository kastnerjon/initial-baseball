import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  isDailyPointsRulesetVersion,
  type DailyRulesetVersion,
  type DailyShareResult,
} from '@initial-baseball/shared';

export function formatDailyShareText(result: DailyShareResult): string {
  const scoreLine = isDailyPointsRulesetVersion(result.rulesetVersion)
    ? `${result.points.points}/${result.points.maximumPoints} PTS · ${result.summary.strikeouts} K`
    : `${result.summary.runs} R / ${result.summary.hits} H / ${result.summary.outs} OUT`;
  const lines = [
    `${getDailyModeName(result.rulesetVersion)} #${result.puzzleNumber}`,
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

export function getDailyModeName(rulesetVersion: DailyRulesetVersion): string {
  if (rulesetVersion === CLASSIC_DAILY_RULESET_VERSION) return 'Classic Inning';
  if (rulesetVersion === POINTS_V2_DAILY_RULESET_VERSION) return 'Daily Nine';
  return 'Daily Inning';
}
