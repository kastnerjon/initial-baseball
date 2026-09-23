import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDailyShareResult, formatDailyShareText } from '@initial-baseball/engine';
import { createInitialDemoGameState, DEMO_DAILY_PUZZLE } from '../mockDailyPuzzle';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

(globalThis as Record<string, unknown>).React = React;

describe('private scorecard and public share card', () => {
  it('renders Daily Nine as an initials / Player / Score / Avg comparison grid', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'BB', outcome: 'K' }, { initials: 'KGJ', outcome: 'HR' }]}
      answers={{ 1: 'Barry Bonds', 2: 'Ken Griffey Jr.' }}
      points={{ 1: 0, 2: 7 }}
      comparisons={{
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      }}
      title="At-bat Results" emptyLabel="No results" compact
    />);

    expect(html).toContain('daily-nine-scorecard-table');
    expect(html).toContain('>Player<');
    expect(html).toContain('>Score<');
    expect(html).toContain('>Avg<');
    expect(html).toMatch(/BB:<.*Your score 0.*>0<.*Average score 7\.0.*>7\.0</);
    expect(html).toMatch(/KGJ:<.*Your score 7.*>7<.*Average score —.*>—</);
    expect(html).toContain('Barry Bonds');
    expect(html).toContain('Ken Griffey Jr.');
    expect(html).not.toContain('>K</strong>');
    expect(html).not.toContain('>HR</strong>');
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
    expect(shareCard).toContain('KGJ:');
    expect(shareCard).toContain('4.8');
    expect(shareCard).not.toContain('KGJ: K');
    expect(shareCard).not.toContain('Ken Griffey Jr.');
  });
});
