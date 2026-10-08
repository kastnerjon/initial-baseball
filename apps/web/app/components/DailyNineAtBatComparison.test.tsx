import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyNineAtBatComparison } from './DailyNineAtBatComparison';

(globalThis as Record<string, unknown>).React = React;

describe('DailyNineAtBatComparison', () => {
  it('keeps the selected bucket dark and outlined, including zero-count buckets, on narrow screens', () => {
    const css = readFileSync(new URL('../daily-results.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.at-bat-distribution-selected\s*\{[^}]*background:[^;]+;[^}]*box-shadow:[^;]+;/);
    expect(css).toMatch(/\.at-bat-distribution-selected \.at-bat-distribution-bar\s*\{[^}]*background:/);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.at-bat-distribution-count/);
  });

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
    expect(html).toContain("1 other result");
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

  it('renders six accessible distribution bars and highlights the resolved score', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison state={{
        status: 'success',
        ownPoints: 2,
        resolvedAtBatCount: 100,
        averagePoints: 1.72,
        strictLowerAtBatRate: 0.46,
        rulesetVersion: 'points-v4',
        scoreHistogram: [18, 12, 16, 0, 24, 0, 18, 0, 12],
      }} />,
    );
    expect(html).toContain('How everyone scored on this at-bat');
    expect(html).toContain('Average: 1.7 pts · Based on 100 other results');
    expect(html).not.toContain('at-bat-comparison-values');
    expect(html).not.toContain('at-bat-comparison-performance');
    expect(html).not.toContain('at-bat-comparison-note');
    expect(html).not.toContain('Above AVG');
    expect((html.match(/46%/g) ?? []).length).toBe(1);
    expect(html).toContain('You scored more than 46% of other players');
    expect(html).toContain('2 points (2B): 24 answers, 24%, your score');
    expect(html).toContain('% of answers / # answers');
    expect(html).toContain('at-bat-distribution-count');
    expect(html).toContain('>#24</span>');
    expect(html).toContain('>24%</strong>');
    expect(html).toContain('>YOU</span>');
    expect(html).toContain('at-bat-distribution-selected');
    expect(html).not.toMatch(/ties (?:aren't|aren&#x27;t|aren’t) counted/i);
    expect((html.match(/class="at-bat-distribution-column/g) ?? []).length).toBe(6);
  });

  it('highlights your selected outcome even when no peers chose it', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison state={{
        status: 'success',
        ownPoints: 0,
        resolvedAtBatCount: 1,
        averagePoints: 4,
        strictLowerAtBatRate: 0,
        rulesetVersion: 'points-v4',
        scoreHistogram: [0, 0, 0, 0, 0, 0, 0, 0, 1],
      }} />,
    );
    expect(html).toContain('0 points (K): 0 answers, 0%, your score');
    expect(html).toContain('>0%</strong>');
    expect(html).toContain('>#0</span>');
    expect(html).toContain('at-bat-distribution-selected');
    expect((html.match(/>YOU<\/span>/g) ?? []).length).toBe(1);
    expect(html).toContain('You scored more than 0%');
  });

  it('does not duplicate the peer sample or average with a one-result chart', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison state={{
        status: 'success', ownPoints: 2, resolvedAtBatCount: 1,
        averagePoints: 1, strictLowerAtBatRate: 1,
        rulesetVersion: 'points-v4',
        scoreHistogram: [0, 0, 1, 0, 0, 0, 0, 0, 0],
      }} />,
    );
    expect(html).toContain('Average: 1.0 pts · Based on 1 other result');
    expect((html.match(/1 other result/g) ?? []).length).toBe(1);
    expect(html).not.toContain('at-bat-comparison-values');
  });

  it('keeps the old textual comparison when histogram data is unavailable', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison state={{
        status: 'success', ownPoints: 2, resolvedAtBatCount: 1,
        averagePoints: 1, strictLowerAtBatRate: 1,
      }} />,
    );
    expect(html).toContain('BEAT 100%');
    expect(html).toContain('>YOU<');
    expect(html).toContain('>AVG<');
    expect(html).toContain('1 other result');
    expect(html).not.toContain('at-bat-distribution-bars');
  });

  it('retains the text comparison for historical scoring even when a histogram exists', () => {
    const html = renderToStaticMarkup(
      <DailyNineAtBatComparison state={{
        status: 'success', ownPoints: 4, resolvedAtBatCount: 1,
        averagePoints: 2, strictLowerAtBatRate: 1,
        rulesetVersion: 'points-v3', scoreHistogram: [0, 0, 1, 0, 0, 0, 0, 0],
      }} />,
    );
    expect(html).toContain('BEAT 100%');
    expect(html).toContain('Above AVG');
    expect(html).not.toContain('How everyone scored');
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
