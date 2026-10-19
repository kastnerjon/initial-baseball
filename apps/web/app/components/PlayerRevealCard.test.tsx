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


describe('PlayerRevealCard season table mobile presentation contract', () => {
  it('marks Team separately so narrow CSS can let it scroll while Season remains the row header', () => {
    const html = renderToStaticMarkup(<PlayerRevealCard reveal={reveal} />);
    const seasonTables = [...html.matchAll(/<div class="player-reveal-stat-strip"[^>]*aria-label="Season-by-season[^>]*>(.*?)<\/table>/g)]
      .map((match) => match[1] ?? '');

    expect(seasonTables).toHaveLength(2);
    for (const table of seasonTables) {
      expect(table).toContain('<th scope="col" class="stat-team">Team</th>');
      expect(table).toContain('<th scope="row">2025</th>');
      expect(table).toContain('<td class="stat-team">NYA</td>');
    }
  });
});

describe('PlayerRevealCard full team history', () => {
  it('displays long ordered careers with repeated club appearances', () => {
    const clubs = ['OAK','NYY','OAK','TOR','OAK','SDP','ANA','SDP','OAK','NYN','SEA','SDP','BOS','LAD'];
    const html = renderToStaticMarkup(<PlayerRevealCard reveal={{ ...reveal, teamIds: clubs }} />);
    expect(html).toContain(clubs.join(', '));
    expect(html).toContain('class="player-reveal-teams"');
  });
});

describe('PlayerRevealCard sourced single-season highs', () => {
  const peaks = {
    homeRuns: { season: 2001, value: 73 },
    strikeouts: { season: 1997, value: 292 },
  };
  function render(role: CanonicalRevealViewModel['playerType'], values: CanonicalRevealViewModel['career']['regularSeasonPeaks']) {
    return renderToStaticMarkup(<PlayerRevealCard reveal={{
      ...reveal, playerType: role, career: { ...reveal.career, regularSeasonPeaks: values },
    }} />);
  }

  it('shows only the relevant sourced category for hitters and pitchers', () => {
    const hitter = render('hitter', peaks);
    expect(hitter).toContain('Single-season highs');
    expect(hitter).toContain('<dt>Home runs</dt><dd><strong>73</strong> <span>(2001)</span></dd>');
    expect(hitter).not.toContain('<dt>Strikeouts</dt>');

    const pitcher = render('pitcher', peaks);
    expect(pitcher).toContain('<dt>Strikeouts</dt><dd><strong>292</strong> <span>(1997)</span></dd>');
    expect(pitcher).not.toContain('<dt>Home runs</dt>');
  });

  it('shows both categories for two-way players, retaining existing career tables', () => {
    const html = render('two-way', peaks);
    expect(html).toContain('aria-label="Single-season highs"');
    expect(html).toContain('<dt>Home runs</dt>');
    expect(html).toContain('<dt>Strikeouts</dt>');
    expect(html).toContain('aria-label="Career batting summary"');
    expect(html).toContain('aria-label="Career pitching summary"');
  });

  it('omits unsupported highs and tolerates old saved reveals', () => {
    expect(render('hitter', undefined)).not.toContain('Single-season highs');
    const zero = render('hitter', { homeRuns: { season: 1912, value: 0 }, strikeouts: null });
    expect(zero).toContain('<strong>0</strong> <span>(1912)</span>');
    expect(render('two-way', { homeRuns: null, strikeouts: null })).not.toContain('Single-season highs');
  });
});
