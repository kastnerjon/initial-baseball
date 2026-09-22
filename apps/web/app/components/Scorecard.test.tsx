import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDailyShareResult, formatDailyShareText } from '@initial-baseball/engine';
import { createInitialDemoGameState, DEMO_DAILY_PUZZLE } from '../mockDailyPuzzle';
import { GameCompleteView } from './GameCompleteView';
import { PitchResultList } from './PitchResultList';

(globalThis as Record<string, unknown>).React = React;

describe('private scorecard and public share card', () => {
  it('shows resolved answers in order, including Ks, without exposing unplayed answers', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'AB', outcome: '3B' }, { initials: 'MP', outcome: 'K' }]}
      answers={{ 1: 'Andy Benes', 2: 'Mike Piazza', 3: 'Unplayed Answer' }}
      title="At-bat Results" emptyLabel="No results" compact
    />);
    expect(html).toMatch(/AB<.*Andy Benes<.*3B</);
    expect(html).toMatch(/MP<.*Mike Piazza<.*K</);
    expect(html).not.toContain('Unplayed Answer');
    expect(html).toContain('<details');
  });

  it('keeps missing historical answers honest', () => {
    const html = renderToStaticMarkup(<PitchResultList
      pitchLines={[{ initials: 'AB', outcome: 'K' }]} title="At-bat Results" emptyLabel="No results"
    />);
    expect(html).toContain('Answer unavailable');
  });

  it('keeps answers private while adding whole-game AVG to both completed scorecards', () => {
    const gameState = createInitialDemoGameState(DEMO_DAILY_PUZZLE);
    gameState.completedPitchLines = [{ initials: 'KGJ', outcome: 'HR' }];
    const shareResult = createDailyShareResult({ gameState, url: 'https://example.com' });
    const shareText = formatDailyShareText(shareResult);
    const html = renderToStaticMarkup(<GameCompleteView
      shareResult={shareResult}
      shareText={shareText}
      scorecardAnswers={{ 1: 'Ken Griffey Jr.' }}
      comparison={{
        status: 'success',
        ownPoints: shareResult.points.points,
        completedGameCount: 12,
        averageTotalPoints: 30.5,
        strictLowerFinishRate: 0.5,
      }}
    />);

    expect(html).toContain('Ken Griffey Jr.');
    expect(html).toContain('scorecard-summary-metric');
    expect(html).toContain('AVG');
    expect(html).toContain('30.5');

    const shareCard = html.slice(html.indexOf('aria-label="Spoiler-free share card"'));
    expect(shareCard).toContain('>Copy</button>');
    expect(shareCard).toContain('role="status"');
    expect(shareCard).toContain('AVG 30.5 · 12 completed results');
    expect(shareCard).not.toContain('Ken Griffey Jr.');
    expect(shareText).not.toContain('Ken Griffey Jr.');
  });
});
