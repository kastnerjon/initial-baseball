import type { JSX } from 'react';
import type { DailyBaseState, DailyPuzzle, DailyScoreSummary } from '@initial-baseball/shared';
import { ScorebugShell } from './ScorebugShell';

type DailyScorebugProps = {
  puzzleNumber: DailyPuzzle['puzzleNumber'];
  summary: DailyScoreSummary;
  bases: DailyBaseState;
  currentStrikeCount: number;
};

export function DailyScorebug({
  puzzleNumber,
  summary,
  bases,
  currentStrikeCount,
}: DailyScorebugProps): JSX.Element {
  return (
    <ScorebugShell
      left={<p className="scorebug-title">{`DAILY #${puzzleNumber}`}</p>}
      middle={(
        <div className="scorebug-metrics">
          <ScorebugMetric label="R" value={summary.runs} />
          <ScorebugMetric label="H" value={summary.hits} />
          <BaseOccupancyIndicator bases={bases} />
        </div>
      )}
      right={(
        <div className="scorebug-metrics scorebug-metrics-right">
          <ScorebugMetric label="OUT" value={summary.outs} />
          <ScorebugMetric label="STR" value={`${currentStrikeCount}/3`} />
        </div>
      )}
    />
  );
}

function ScorebugMetric({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="scorebug-metric">
      <span className="scorebug-metric-label">{label}</span>
      <strong className="scorebug-metric-value">{value}</strong>
    </div>
  );
}

function BaseOccupancyIndicator({ bases }: { bases: DailyBaseState }): JSX.Element {
  const baseStates = [
    { label: '1B', occupied: bases.first },
    { label: '2B', occupied: bases.second },
    { label: '3B', occupied: bases.third },
  ];

  return (
    <div className="base-indicator" aria-label="Base occupancy">
      {baseStates.map((base) => (
        <div key={base.label} className="base-indicator-slot">
          <span
            className={base.occupied ? 'base-indicator-dot occupied' : 'base-indicator-dot'}
            aria-hidden="true"
          />
          <span className="base-indicator-label">{base.label}</span>
        </div>
      ))}
    </div>
  );
}
