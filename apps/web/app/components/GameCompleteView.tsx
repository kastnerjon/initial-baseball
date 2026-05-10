import type { JSX } from 'react';
import type { DailyShareResult } from '@initial-baseball/shared';
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
        <ScoreLine summary={shareResult.summary} />
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
