import type { DailyShareResult } from '@initial-baseball/shared';

export function formatDailyShareText(result: DailyShareResult): string {
  const lines = [
    `Daily Inning #${result.puzzleNumber}`,
    'by Initial Baseball',
    '',
    `${result.runs} R / ${result.hits} H / ${result.outs} OUT`,
    '',
    ...result.pitchLines.map((line) => `${line.initials}: ${line.outcome}`),
    '',
    result.url,
  ];

  return lines.join('\n');
}
