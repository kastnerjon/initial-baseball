import type { JSX } from 'react';
import {
  isDailyPointsRulesetVersion,
  type DailyGuessResult,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';
import { createDailyTerminalResultCallout } from './dailyTerminalResultPresentation';

type ResultDisplayProps = {
  result: DailyGuessResult;
  rulesetVersion: DailyRulesetVersion;
  correctAnswer?: string;
  revealAnswer?: boolean;
  awardedPoints?: number;
};

export function ResultDisplay({
  result,
  rulesetVersion,
  correctAnswer,
  revealAnswer = false,
  awardedPoints,
}: ResultDisplayProps): JSX.Element {
  if (result.kind === 'correct' || result.kind === 'strikeout') {
    if (isDailyPointsRulesetVersion(rulesetVersion)) {
      if (awardedPoints === undefined) {
        throw new Error('A resolved Daily Nine result requires authoritative awarded points.');
      }
      const callout = createDailyTerminalResultCallout(result.outcome, awardedPoints);
      return (
        <div
          className={result.kind === 'strikeout'
            ? 'result-card result-card-points result-card-strikeout'
            : 'result-card result-card-points result-card-correct'}
          aria-live="polite"
        >
          <strong className="result-value">{callout}</strong>
          {correctAnswer !== undefined && (result.kind === 'correct' || revealAnswer) ? (
            <p className="result-note">{`Answer: ${correctAnswer}`}</p>
          ) : null}
        </div>
      );
    }

    if (result.kind === 'correct') {
      return (
        <div className="result-card result-card-correct" aria-live="polite">
          <span className="result-label">Outcome</span>
          <strong className="result-value">{result.outcome}</strong>
          {correctAnswer !== undefined ? (
            <p className="result-note">{`Answer: ${correctAnswer}`}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="result-card result-card-strikeout" aria-live="polite">
        <span className="result-label">Outcome</span>
        <strong className="result-value">{result.outcome}</strong>
        <p className="result-note">Strikeout</p>
        {revealAnswer && correctAnswer !== undefined ? (
          <p className="result-note">{`Answer: ${correctAnswer}`}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="result-card result-card-incorrect" aria-live="polite">
      <strong className="result-value">Incorrect</strong>
      <p className="result-note">{`${result.remainingStrikes} strike${result.remainingStrikes === 1 ? '' : 's'} left.`}</p>
    </div>
  );
}
