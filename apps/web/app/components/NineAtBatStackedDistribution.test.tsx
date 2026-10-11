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
    expect(markup).toContain('At-bat 1: Loading comparison');
    expect(markup).toContain('At-bat 2: No other results yet');
    expect(markup).toContain('At-bat 3: Comparison unavailable');
    expect(markup).toContain('At-bat 4 average 0.0 points');
    expect(markup).toContain('At-bat 4 beat 100% of peers');
    expect(markup).toContain('>AVG</span>');
    expect(markup).toContain('>BEAT</span>');
  });
});
