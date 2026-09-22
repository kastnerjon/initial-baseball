import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultDisplay } from './ResultDisplay';

(globalThis as Record<string, unknown>).React = React;

describe('ResultDisplay terminal semantics', () => {
  it('shows Daily Nine terminal results as points rather than baseball outcomes', () => {
    const correct = renderToStaticMarkup(
      <ResultDisplay
        rulesetVersion="points-v3"
        result={{
          kind: 'correct',
          revealedCount: 1,
          outcome: '3B',
          source: 1,
        }}
        revealedCount={1}
        wrongGuesses={2}
      />,
    );
    const strikeout = renderToStaticMarkup(
      <ResultDisplay
        rulesetVersion="points-v3"
        result={{
          kind: 'strikeout',
          revealedCount: 0,
          strikeCount: 3,
          outcome: 'K',
          source: 'strikeout',
        }}
        wrongGuesses={3}
      />,
    );

    expect(correct).toContain('>Score<');
    expect(correct).toContain('4 PTS');
    expect(correct).not.toContain('>3B<');
    expect(correct).not.toContain('>Outcome<');

    expect(strikeout).toContain('>Score<');
    expect(strikeout).toContain('0 PTS');
    expect(strikeout).not.toContain('>K<');
    expect(strikeout).not.toContain('Strikeout');
    expect(strikeout).not.toContain('>Outcome<');
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
