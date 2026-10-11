import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { POINTS_V4_DAILY_RULESET_VERSION as V4 } from '@initial-baseball/shared';
import { NineAtBatStackedDistribution } from './NineAtBatStackedDistribution';

describe('Nine at-bat stacked distribution accessibility', () => {
  it('distinguishes loading, empty peers and unavailable values, with accessible metric labels', () => {
    const markup = renderToStaticMarkup(
      <NineAtBatStackedDistribution
        points={{ 1: 1, 2: 0, 3: 4, 4: 1 }}
        comparisons={{
          1: { status: 'loading' },
          2: { status: 'success', rulesetVersion: V4, resolvedAtBatCount: 0,
            averagePoints: null, scoreHistogram: Array(9).fill(0) },
          3: { status: 'unavailable' },
          4: { status: 'success', rulesetVersion: V4, resolvedAtBatCount: 1,
            averagePoints: 0, scoreHistogram: [1, 0, 0, 0, 0, 0, 0, 0, 0] },
        }}
      />,
    );
    expect(markup).toContain('Loading: AB1');
    expect(markup).toContain('No peers: AB2');
    expect(markup).toContain('Unavailable: AB3');
    expect(markup).toContain('AB1<span class="sr-only">: Loading comparison</span>');
    expect(markup).toContain('AB2<span class="sr-only">: No other results yet</span>');
    expect(markup).toContain('AB3<span class="sr-only">: Comparison unavailable</span>');
    expect(markup).toContain('class="sr-only">At-bat 4 average </span>0.0<span class="sr-only"> points</span>');
    expect(markup).toContain('class="sr-only">At-bat 4 beat </span>100%<span class="sr-only"> of peers</span>');
    expect(markup).not.toMatch(/class=\"score-ab-(?:avg|beat)[^\"]*\" aria-label=/);
    expect(markup).toContain('>AVG</span>');
    expect(markup).toContain('>BEAT</span>');
  });
});
