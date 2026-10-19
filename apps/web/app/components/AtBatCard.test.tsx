import React from 'react';
import { readFileSync } from 'node:fs';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyNineAtBatComparisonState } from '../dailyNineAtBatComparisonState';
import { AtBatCard } from './AtBatCard';

(globalThis as Record<string, unknown>).React = React;

const sampleReveal: CanonicalRevealViewModel = {
  playerId: 'test-player-id',
  displayName: 'Miguel Tejada',
  playerType: 'hitter',
  primaryPosition: 'SS',
  yearsPlayedDisplay: '1997â€“2013',
  teamIds: ['BAL', 'HOU'],
  career: { lines: [{ kind: 'hitter', stats: { AB: 8434, H: 2407, HR: 307 } }] },
  seasons: [],
};


describe('AtBatCard pending resolution feedback', () => {
  it('preserves the historical v3 question prompt', () => {
    const html = renderCard({ requestPending: false, giveUpPending: false, rulesetVersion: 'points-v3' });
    expect(html).toContain('Who is the player?');
    expect(html).not.toContain('aria-live="polite"');
    expect(html).not.toContain('Score:');
  });

  it('moves the live v4 score into the card header and removes the question prompt', () => {
    const html = renderCard({ requestPending: false, giveUpPending: false,
      rulesetVersion: 'points-v4', cumulativePoints: 4.5 });
    expect(html).toContain('Score: 4.5');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="t¶»§q«^