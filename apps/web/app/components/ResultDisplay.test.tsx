import { readFileSync } from 'node:fs';
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

  it('styles resolved point callouts like the Next At Bat primary action without turning them into buttons', () => {
    const css = readFileSync(new URL('../daily-results.css', import.meta.url), 'utf8');
    const gameCss = readFileSync(new URL('../daily-game.css', import.meta.url), 'utf8');
    const resultRule = css.match(/\.result-card-points \.result-value\s*\{([^}]+)\}/)?.[1] ?? '';
    const primaryRule = gameCss.match(/\.button-primary\s*\{([^}]+)\}/)?.[1] ?? '';
    const sharedRule = gameCss.match(/\.button-primary,\s*\.button-secondary\s*\{([^}]+)\}/)?.[1] ?? '';
    for (const declaration of [
      'min-height: 44px', 'border-radius: 5px', 'padding: 10px 18px',
      'border: 1px solid var(--clubhouse)', 'background: var(--clubhouse)', 'color: white',
      'font: 600 14px/1.3 var(--body-font)',
    ]) {
      expect(resultRule).toContain(declaration);
    }
    expect(primaryRule).toContain('background: var(--clubhouse)');
    expect(primaryRule).toContain('color: white');
    expect(sharedRule).toContain('border-radius: 5px');
    expect(sharedRule).toContain('padding: 10px 18px');
    const strikeout = renderToStaticMarkup(
      <ResultDisplay
        rulesetVersion="points-v4"
        result={{ kind: 'strikeout', revealedCount: 0, strikeCount: 3, outcome: 'K', source: 'strikeout' }}
        awardedPoints={0}
      />,
    );
    expect(strikeout).toContain('result-card-points');
    expect(strikeout).toContain('K 0 PTS');
    expect(strikeout).not.toContain('<button');
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
