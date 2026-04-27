import type { JSX } from 'react';
import type { DailyGuessResult } from '@initial-baseball/shared';

type ResultDisplayProps = {
  result: DailyGuessResult;
};

export function ResultDisplay({ result }: ResultDisplayProps): JSX.Element {
  if (result.kind === 'correct') {
    return (
      <div className="result-card">
        <span className="result-label">Outcome</span>
        <strong className="result-value">{result.outcome}</strong>
      </div>
    );
  }

  if (result.kind === 'strikeout') {
    return (
      <div className="result-card">
        <span className="result-label">Outcome</span>
        <strong className="result-value">{result.outcome}</strong>
      </div>
    );
  }

  return (
    <div className="result-card">
      <span className="result-label">Outcome</span>
      <strong className="result-value">Incorrect</strong>
      <p className="result-note">{`${result.remainingStrikes} strike${result.remainingStrikes === 1 ? '' : 's'} left in full game rules.`}</p>
    </div>
  );
}
