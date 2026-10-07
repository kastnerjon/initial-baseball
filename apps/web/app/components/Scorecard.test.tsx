import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDailyShareResult, formatDailyShareText } from '@initial-baseball/engine';
import { createInitialDemoGameState, DEMO_DAILY_PUZZLE } from '../mockDailyPuzzle';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

(globalThis as Record<string, unknown>).React = React;

describe('private scorecard and public share card', () => {
  it('renders the detailed Daily Nine scoreboard with hidden names, combined outcome/score and comparisons', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'BB', outcome: 'K' }, { initials: 'KGJ', outcome: 'HR' }]}
      answers={{ 1: 'Barry Bonds', 2: 'Ken Griffey Jr.' }}
      points={{ 1: 0, 2: 7 }}
      totalPoints={7}
      completedComparison={{
        status: 'success',
        ownPoints: 7,
        completedGameCount: 1,
        averageTotalPoints: 5,
        strictLowerFinishRate: 1,
      }}
      comparisons={{
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      }}
      title="At-bat Results" emptyLabel="No results" compact
    />);

    expect(html).toContain('daily-nine-detail-table');
    expect(html).toContain('>Scoreboard<');
    expect(html).toContain('>Outcome-Score<');
    expect(html).toContain('>BEAT %<');
    expect(html).toContain('role="switch"');
    expect(html).toContain('Outcome K, score 0');
    expect(html).toContain('K - 0');
    expect(html).toContain('HR - 7');
    expect(html).toContain('7.0');
    expect(html).toContain('>TOTAL</th>');
    expect(html).toContain('>100%</td>');
    expect(html).not.toContain('Barry Bonds');
    expect(html).not.toContain('Ken Griffey Jr.');

  });

  it('keeps Classic answer and baseball-outcome rows unchanged', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'AB', outcome: '3B' }]}
      answers={{ 1: 'Andy Benes' }}
      title="At-bat Results" emptyLabel="No results"
    />);

    expect(html).toContain('Andy Benes');
    expect(html).toContain('>3B</strong>');
    expect(html).not.toContain('daily-nine-scorecard-table');
  });

  it('uses the same score/AVG row semantics in spoiler-safe share output', () => {
    const gameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    gameState.completedPitchLines = [{ initials: 'KGJ', outcome: 'K' }];
    const shareResult = createDailyShareResult({ gameState, url: 'https://example.com' });
    const shareText = formatDailyShareText(shareResult);
    const html = renderToStaticMarkup(<GameCompleteView
      shareResult={shareResult}
      shareText={shareText}
      scorecardAnswers={{ 1: 'Ken Griffey Jr.' }}
      atBatPoints={{ 1: 0 }}
      comparison={{
        status: 'success',
        ownPoints: shareResult.points.points,
        completedGameCount: 12,
        averageTotalPoints: 30.5,
        strictLowerFinishRate: 0.5,
      }}
      atBatComparisons={{
        1: { status: 'success', resolvedAtBatCount: 4, averagePoints: 4.76 },
      }}
    />);

    const shareCard = html.slice(html.indexOf('aria-label="Spoiler-free share card"'));
    expect(shareCard).toContain('SCORE');
    expect(shareCard).toContain('AVG');
    expect(shareCard).not.toContain('OUTCOME');
    expect(shareCard).toContain('KGJ:');
    expect(shareCard).toContain('4.8');
    expect(shareCard).not.toContain('KGJ: K');
    expect(shareCard).not.toContain('Ken Griffey Jr.');
  });
});
