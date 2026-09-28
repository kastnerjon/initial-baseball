import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultDisplay } from './ResultDisplay';

(globalThis as Record<string, unknown>).React = React;

describe('ResultDisplay terminal semantics', () => {
  it('shows Daily Nine terminal results as baseball-native point callouts', () => {
    const correct = renderToStaticMarkup(
      <ResultDisplay
        rulesetVersion="points-v4"
        result={{
          kind: 'correct',
          revealedCount: 0,
          outcome: 'HR',
          source: 'initials',
        }}
        awardedPoints={4}
      />,
    );
    const strikeout = renderToStaticMarkup(
      <ResultDisplay
        rulesetVersion="points-v4"
        result={{
          kind: 'strikeout',
          revealedCount: 0,
          strikeCount: 3,
          outcome: 'K',
          source: 'strikeout',
        }}
        awardedPoints={0}
      />,
    );

    expect(correct).toContain('result-card-points');
    expect(correct).toContain('>HR! 4 PTS<');
    expect(correct).not.toContain('>Score<');

    expect(strikeout).toContain('result-card-points');
    expect(strikeout).toContain('>K 0 PTS<');
    expect(strikeout).not.toContain('>Score<');
    expect(strikeout).not.toContain('Strikeout');
  });

  it('keeps Classic terminal results baseball-native', () => {
    const html = renderToStaticMarkup(
      <ResultDisplay
        rulesetVersion="classic-inning-v1"
        result={{
          kind: 'correct',
          revealedCount: 1,
          outcome: '3B',
          source: 1,
        }}
      />,
    );

    expect(html).toContain('>Outcome<');
    expect(html).toContain('>3B<');
    expect(html).not.toContain('PTS');
  });
});
