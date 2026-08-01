import type { JSX } from 'react';
import { getDailyOutcomePoints } from '@initial-baseball/engine';
import type { DailyGuessResult, DailyRulesetVersion } from '@initial-baseball/shared';
import { formatDailyAwardedPoints } from './formatDailyAwardedPoints';

type ResultDisplayProps = {
  result: DailyGuessResult;
  rulesetVersion: DailyRulesetVersion;
  correctAnswer?: string;
  revealAnswer?: boolean;
};

export function ResultDisplay({
  result,
  rulesetVersion,
  correctAnswer,
  revealAnswer = false,
}: ResultDisplayProps): JSX.Element {
  if (result.kind === 'correct') {
    return (
      <div className="result-card">
        <span className="result-label">Outcome</span>
        <strong className="result-value">{result.outcome}</strong>
        <p className="result-note">
          {formatDailyAwardedPoints(getDailyOutcomePoints(rulesetVersion, result.outcome))}
        </p>
        {correctAnswer !== undefined ? (
          <p className="result-note">{`Answer: ${correctAnswer}`}</p>
        ) : null}
      </div>
    );
  }

  if (result.kind === 'strikeout') {
    return (
      <div className="result-card">
        <span className="result-label">Outcome</span>
        <strong className="result-value">{result.outcome}</strong>
        <p className="result-note">
          {`Strikeout · ${formatDailyAwardedPoints(getDailyOutcomePoints(rulesetVersion, result.outcome))}`}
        </p>
        {revealAnswer && correctAnswer !== undefined ? (
          <p className="result-note">{`Answer: ${correctAnswer}`}</p>
        ) : null}
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
