import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDailyShareResult, formatDailyShareText } from '@initial-baseball/engine';
import { createInitialDemoGameState, DEMO_DAILY_PUZZLE } from '../mockDailyPuzzle';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

(globalThis as Record<string, unknown>).React = React;

describe('private scorecard and public share card', () => {
  it('shows answer, personal AB points and AVG on one Daily Nine scorecard row', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'BB', outcome: 'K' }, { initials: 'KGJ', outcome: 'HR' }]}
      answers={{ 1: 'Barry Bonds', 2: 'Ken Griffey Jr.', 3: 'Unplayed Answer' }}
      points={{ 1: 0, 2: 7 }}
      comparisons={{
        1: { status: 'success', resolvedAtBatCount: 2, averagePoints: 7 },
        2: { status: 'success', resolvedAtBatCount: 1, averagePoints: 6 },
      }}
      title="At-bat Results" emptyLabel="No results" compact
    />);

    expect(html).toMatch(/BB<.*Barry Bonds<.*Your score 0.*>0<.*AVG 7\.0</);
    expect(html).toMatch(/KGJ<.*Ken Griffey Jr\.<.*Your score 7.*>7</);
    expect(html).not.toContain('>K</strong>');
    expect(html).not.toContain('>HR</strong>');
    expect(html).not.toContain('AVG 6.0');
    expect(html).not.toContain('Unplayed Answer');
    expect(html).toContain('scorecard-row-points');
  });

  it('keeps Classic baseball-outcome rows unchanged when no points map is supplied', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'AB', outcome: '3B' }]}
      answers={{ 1: 'Andy Benes' }}
      title="At-bat Results" emptyLabel="No results"
    />);

    expect(html).toContain('Andy Benes');
    expect(html).toContain('>3B</strong>');
    expect(html).not.toContain('scorecard-row-points');
  });

  it('keeps answers private while sharing personal AB points versus AVG', () => {
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

    expect(html).toContain('Ken Griffey Jr.');
    expect(html).toContain('Your score 0');
    expect(html).toContain('AVG 4.8');

    const shareCard = html.slice(html.indexOf('aria-label="Spoiler-free share card"'));
    expect(shareCard).toContain('>Copy</button>');
    expect(shareCard).toContain('role="status"');
    expect(shareCard).toContain('KGJ: 0 • AVG: 4.8');
    expect(shareCard).not.toContain('KGJ: K');
    expect(shareCard).not.toContain('Ken Griffey Jr.');
    expect(shareText).not.toContain('Ken Griffey Jr.');
  });
});
