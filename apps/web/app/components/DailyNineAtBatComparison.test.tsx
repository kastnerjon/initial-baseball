import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyNineAtBatComparison } from './DailyNineAtBatComparison';

(globalThis as Record<string, unknown>).React = React;

describe('DailyNineAtBatComparison', () => {
  it('shows one-other-result AVG and strict-lower BEAT with explicit green status text', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison
        state={{
          status: 'success',
          ownPoints: 4,
          resolvedAtBatCount: 1,
          averagePoints: 2,
          strictLowerAtBatRate: 1,
        }}
      />,
    );

    expect(html).toContain('>AVG<');
    expect(html).toContain('>2.0<');
    expect(html).toContain('BEAT 100%');
    expect(html).toContain('Above AVG');
    expect(html).toContain('at-bat-comparison-performance-above');
    expect(html).toContain("1 other result · ties aren&#x27;t counted as beaten");
  });

  it('treats a tie as BEAT 0% and explicit red/not-above status', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison
        state={{
          status: 'success',
          ownPoints: 2,
          resolvedAtBatCount: 1,
          averagePoints: 2,
          strictLowerAtBatRate: 0,
        }}
      />,
    );

    expect(html).toContain('BEAT 0%');
    expect(html).toContain('At or below AVG');
    expect(html).toContain('at-bat-comparison-performance-at-or-below');
  });

  it('keeps personal points visible while comparison is still loading', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison state={{ status: 'loading', ownPoints: 4 }} />,
    );

    expect(html).toContain('>4<');
    expect(html).toContain('>…<');
    expect(html).toContain('Loading comparison…');
    expect(html).not.toContain('BEAT ');
  });
});
