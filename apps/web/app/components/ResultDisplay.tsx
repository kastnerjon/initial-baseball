import type { JSX } from 'react';
import { getDailyAtBatPoints } from '@initial-baseball/engine';
import {
  isDailyPointsRulesetVersion,
  type DailyGuessResult,
  type DailyRevealCount,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';

type ResultDisplayProps = {
  result: DailyGuessResult;
  rulesetVersion: DailyRulesetVersion;
  correctAnswer?: string;
  revealAnswer?: boolean;
  revealedCount?: DailyRevealCount;
  wrongGuesses?: number;
};

export function ResultDisplay({
  result,
  rulesetVersion,
  correctAnswer,
  revealAnswer = false,
  revealedCount = 0,
  wrongGuesses = 0,
}: ResultDisplayProps): JSX.Element {
  if (result.kind === 'correct' || result.kind === 'strikeout') {
    if (isDailyPointsRulesetVersion(rulesetVersion)) {
      const points = getDailyAtBatPoints({
        rulesetVersion,
        outcome: result.outcome,
        hintsRevealed: revealedCount,
        wrongGuesses,
      });
      return (
        <div
          className={result.kind === 'strikeout'
            ? 'result-card result-card-strikeout'
            : 'result-card result-card-correct'}
          aria-live="polite"
        >
          <span className="result-label">Score</span>
          <strong className="result-value">{`${points} PTS`}</strong>
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
