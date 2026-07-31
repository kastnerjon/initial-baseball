import type { JSX } from 'react';
import { POINTS_V1_DAILY_RULESET_VERSION, type DailyShareResult } from '@initial-baseball/shared';
import { PitchResultList } from './PitchResultList';
import { ScoreLine } from './ScoreLine';

type GameCompleteViewProps = {
  shareResult: DailyShareResult;
  shareText: string;
  onResetToday?: () => void;
};

export function GameCompleteView({ shareResult, shareText, onResetToday }: GameCompleteViewProps): JSX.Element {
  return (
    <div className="game-shell">
      <section className="complete-card">
        <h2>Game Complete</h2>
        {shareResult.rulesetVersion === POINTS_V1_DAILY_RULESET_VERSION ? (
          <div className="score-line" aria-label="Final Daily score">
            <span>{`${shareResult.points.points}/${shareResult.points.maximumPoints} PTS`}</span>
            <span>{`${shareResult.points.atBatsCompleted}/${shareResult.points.totalAtBats} AB`}</span>
            <span>{`${shareResult.summary.strikeouts} K`}</span>
          </div>
        ) : (
          <ScoreLine summary={shareResult.summary} />
        )}
      </section>
      <PitchResultList
        pitchLines={shareResult.pitchLines}
        title="At-bat Results"
        emptyLabel="No at-bat results were recorded."
      />
      <section className="share-card">
        <h2>Share Text</h2>
        <pre className="share-text">{shareText}</pre>
      </section>
      {onResetToday !== undefined ? (
        <button
          type="button"
          className="reset-local-result-button"
          onClick={onResetToday}
        >
          Reset today's local result
        </button>
      ) : null}
    </div>
  );
}
