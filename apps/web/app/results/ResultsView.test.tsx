import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultsList } from './ResultsView';
import type { BrowserCompletedGame } from '../browserCompletedGameHistory';

const game: BrowserCompletedGame = {
  key: 'opaque-key', puzzleId: 'opaque-puzzle', puzzleDate: '2026-10-01', puzzleNumber: 1,
  mode: 'Daily', rulesetVersion: 'points-v4', submissionStatus: 'submitted',
  score: 3.5, maximum: 36, totalAtBats: 9,
  atBats: [{ pitchNumber: 1, initials: 'AB', outcome: '3B', hintsRevealed: 1, wrongGuesses: 0, resolution: 'correct', score: 3 }],
};

describe('My Results presentation', () => {
  it('renders score and accessible earned at-bat details without attempt credentials or navigation by date', () => {
    const html = renderToStaticMarkup(<ResultsList history={{ status: 'ready', games: [game], unreadableRecords: 0 }} />);
    expect(html).toContain('<details');
    expect(html).toContain('<summary>');
    expect(html).toContain('3.5 / 36');
    expect(html).toContain('<caption>Daily #1');
    expect(html).toContain('scope="col">Initials');
    expect(html).toContain('AB</td>');
    expect(html).toContain('3B</td>');
    expect(html).not.toContain('opaque-key');
    expect(html).not.toContain('opaque-puzzle');
    expect(html).not.toContain('href=');
  });
  it('shows Classic runs rather than an invented point maximum', () => {
    const html = renderToStaticMarkup(<ResultsList history={{ status: 'ready', games: [{ ...game, mode: 'Classic', maximum: null, score: 2 }], unreadableRecords: 0 }} />);
    expect(html).toContain('2 runs');
    expect(html).toContain('scope="col">Runs');
    expect(html).not.toContain('/ 36');
  });
  it('keeps empty, unreadable and unavailable history honest', () => {
    expect(renderToStaticMarkup(<ResultsList history={null} />)).toContain('Loading');
    expect(renderToStaticMarkup(<ResultsList history={{ status: 'unavailable' }} />)).toContain('aren’t available');
    const html = renderToStaticMarkup(<ResultsList history={{ status: 'ready', games: [], unreadableRecords: 1 }} />);
    expect(html).toContain('couldn’t be read');
    expect(html).toContain('No completed games');
    expect(html).not.toContain('0 /');
  });
});
