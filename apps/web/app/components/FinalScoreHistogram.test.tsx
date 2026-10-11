import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FinalScoreHistogram } from './FinalScoreHistogram';

describe('completed histogram score marker', () => {
  it('renders the zero-score label outside the stretched SVG graphic', () => {
    const histogram = Array.from({ length: 73 }, (_, i) => i === 0 ? 1 : 0);
    const html = renderToStaticMarkup(<FinalScoreHistogram comparison={{
      status: 'success', rulesetVersion: 'points-v4', ownPoints: 0,
      completedGameCount: 1, scoreHistogram: histogram,
      averageTotalPoints: 0, strictLowerFinishRate: 0,
    }} />);
    expect(html).toContain('score-final-marker-label');
    expect(html).toContain('>0</strong>');
    expect(html).not.toContain('score-final-marker-text');
  });
});
