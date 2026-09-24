import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CanonicalRevealViewModel } from '../canonicalRevealViewModel';
import { DEFAULT_REVEAL_COLUMNS } from '../revealPresentationConfig';
import { PlayerRevealCard } from './PlayerRevealCard';

(globalThis as Record<string, unknown>).React = React;

const batting = Object.fromEntries(DEFAULT_REVEAL_COLUMNS.hitter.map((column) => [column, column]));
const pitching = Object.fromEntries(DEFAULT_REVEAL_COLUMNS.pitcher.map((column) => [column, column]));
const reveal: CanonicalRevealViewModel = {
  playerId: 'ibp_test',
  displayName: 'Two Way Player',
  playerType: 'two-way',
  primaryPosition: 'P',
  yearsPlayedDisplay: '2024–2025',
  teamIds: ['NYA'],
  career: { lines: [{ kind: 'hitter', stats: batting }, { kind: 'pitcher', stats: pitching }] },
  seasons: [{
    season: 2025,
    teamIds: ['NYA'],
    lines: [{ kind: 'hitter', stats: batting }, { kind: 'pitcher', stats: pitching }],
  }],
};

describe('PlayerRevealCard stat columns', () => {
  it('renders matching career and season hitter order while leaving two-way pitching tables intact', () => {
    const html = renderToStaticMarkup(<PlayerRevealCard reveal={reveal} />);
    const headings = [...html.matchAll(/<thead>(.*?)<\/thead>/g)].map((match) =>
      [...(match[1] ?? '').matchAll(/<abbr title="[^"]+">([^<]+)<\/abbr>/g)].map((column) => column[1]));

    expect(headings).toEqual([
      ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'BA', 'OBP', 'SLG', 'OPS'],
      ['W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP'],
      ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'BA', 'OBP', 'SLG', 'OPS'],
      ['W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP'],
    ]);
    expect(html.match(/role="region" aria-label="(?:Career|Season-by-season) batting/g)).toHaveLength(2);
    expect(html.match(/role="region" aria-label="(?:Career|Season-by-season) pitching/g)).toHaveLength(2);
  });
});
