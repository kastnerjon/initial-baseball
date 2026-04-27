import type { JSX } from 'react';
import type { DailyScoreSummary } from '@initial-baseball/shared';

type ScoreLineProps = {
  summary: DailyScoreSummary;
};

export function ScoreLine({ summary }: ScoreLineProps): JSX.Element {
  return (
    <p className="score-line" aria-label="Daily inning score">
      <span>{`${summary.runs} R`}</span>
      <span>{`${summary.hits} H`}</span>
      <span>{`${summary.outs} OUT`}</span>
    </p>
  );
}
