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
      left={(
        <div className="scorebug-identity">
          <span className="scorebug-kicker">Today</span>
          <p className="scorebug-title">{`#${puzzleNumber}`}</p>
        </div>
      )}
      middle={(
        <div className="scorebug-metrics">
          <ScorebugMetric label="R" value={summary.runs} />
          <ScorebugMetric label="H" value={summary.hits} />
          <BaseOccupancyIndicator bases={bases} />
        </div>
      )}
      right={(
        <div className="count-panel">
          <CountIndicator label="Outs" filledCount={Math.min(summary.outs, 2)} total={2} />
          <CountIndicator label="Strikes" filledCount={Math.min(currentStrikeCount, 3)} total={3} />
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
  return (
    <div className="diamond-shell">
      <span className="scorebug-section-label">Bases</span>
      <div className="base-diamond" aria-label="Base occupancy">
        <BaseMarker className="base-marker-second" occupied={bases.second} label="Second base" />
        <BaseMarker className="base-marker-third" occupied={bases.third} label="Third base" />
        <BaseMarker className="base-marker-first" occupied={bases.first} label="First base" />
      </div>
    </div>
  );
}

function BaseMarker({
  className,
  occupied,
  label,
}: {
  className: string;
  occupied: boolean;
  label: string;
}): JSX.Element {
  return (
    <span
      className={occupied ? `base-marker ${className} occupied` : `base-marker ${className}`}
      aria-label={label}
    />
  );
}

function CountIndicator({
  label,
  filledCount,
  total,
}: {
  label: string;
  filledCount: number;
  total: number;
}): JSX.Element {
  return (
    <div className="count-indicator">
      <span className="scorebug-section-label">{label}</span>
      <div className="count-markers" aria-label={label}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={`${label}-${index}`}
            className={index < filledCount ? 'count-marker filled' : 'count-marker'}
            aria-hidden="true"
          >
            {index < filledCount ? '●' : '○'}
          </span>
        ))}
      </div>
    </div>
  );
}
