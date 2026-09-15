import type { JSX } from 'react';
import {
  isDailyPointsRulesetVersion,
  type DailyBaseState,
  type DailyPointsSummary,
  type DailyRulesetVersion,
  type DailyScoreSummary,
} from '@initial-baseball/shared';
import { ScorebugShell } from './ScorebugShell';

type DailyScorebugProps = {
  currentAtBat: number;
  totalAtBats: number;
  rulesetVersion: DailyRulesetVersion;
  summary: DailyScoreSummary;
  points: DailyPointsSummary;
  bases: DailyBaseState;
  atBatPointsRemaining?: number | null;
};

export function DailyScorebug({
  currentAtBat,
  totalAtBats,
  rulesetVersion,
  summary,
  points,
  bases,
  atBatPointsRemaining = null,
}: DailyScorebugProps): JSX.Element {
  const isPointsGame = isDailyPointsRulesetVersion(rulesetVersion);

  return (
    <ScorebugShell
      left={(
        <div className="scorebug-identity">
          <p className="scorebug-title">{`At bat ${currentAtBat} of ${totalAtBats}`}</p>
        </div>
      )}
      middle={isPointsGame ? (
        <div className="scorebug-metrics">
          <ScorebugMetric label="Points" value={points.points} />
          {atBatPointsRemaining === null ? null : (
            <ScorebugMetric label="This AB" value={atBatPointsRemaining} />
          )}
        </div>
      ) : (
        <div className="scorebug-metrics">
          <ScorebugMetric label="R" value={summary.runs} />
          <ScorebugMetric label="H" value={summary.hits} />
          <BaseOccupancyIndicator bases={bases} />
        </div>
      )}
      right={(
        <div className="count-panel">
          {isPointsGame
            ? <ScorebugMetric label="Strikeouts" value={summary.strikeouts} />
            : <CountIndicator label="Outs" filledCount={summary.outs} total={3} />}
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
      aria-label={`${label} ${occupied ? 'occupied' : 'empty'}`}
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
      <div className="count-markers" aria-label={`${filledCount} ${label.toLowerCase()}`} role="img">
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
