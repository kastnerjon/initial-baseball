import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import { describe, expect, it } from 'vitest';
import { createCanonicalRevealViewModel } from './canonicalRevealViewModel';

describe('createCanonicalRevealViewModel', () => {
  it('preserves both batting and pitching lines for a two-way player', () => {
    const viewModel = createCanonicalRevealViewModel(buildTwoWayReveal());

    expect(viewModel.playerType).toBe('two-way');
    expect(viewModel.career.lines.map((line) => line.kind)).toEqual([
      'hitter',
      'pitcher',
    ]);
    expect(viewModel.career.lines[0]?.stats).toMatchObject({
      HR: 225,
      OPS: '.956',
    });
    expect(viewModel.career.lines[1]?.stats).toMatchObject({
      W: 80,
      ERA: '3.01',
      K: 1050,
    });
    expect(viewModel.seasons[0]?.lines.map((line) => line.kind)).toEqual([
      'hitter',
      'pitcher',
    ]);
    expect(viewModel.seasons[0]?.lines[0]?.stats).toMatchObject({
      HR: 44,
      OPS: '1.066',
    });
    expect(viewModel.seasons[0]?.lines[1]?.stats).toMatchObject({
      W: 10,
      ERA: '3.14',
      K: 167,
    });
  });
});

function buildTwoWayReveal(): CanonicalPlayerReveal {
  return {
    schemaVersion: 1,
    playerId: 'ibp_ab000000000000000000',
    lahmanPlayerId: 'ohtansh01',
    displayName: 'Shohei Ohtani',
    playerType: 'two-way',
    career: {
      firstSeason: 2018,
      lastSeason: 2026,
      seasonCount: 9,
      teamIds: ['LAA', 'LAD'],
      primaryPosition: 'P',
      batting: {
        atBats: 3500,
        runs: 650,
        hits: 980,
        doubles: 190,
        triples: 40,
        homeRuns: 225,
        runsBattedIn: 610,
        stolenBases: 150,
        walks: 450,
        battingAverage: 0.28,
        sluggingPercentage: 0.58,
      },
      pitching: {
        wins: 80,
        losses: 35,
        saves: 0,
        outsPitched: 3000,
        hitsAllowed: 750,
        earnedRuns: 335,
        walksAllowed: 300,
        strikeouts: 1050,
        earnedRunAverage: 3.01,
        whip: 1.05,
      },
      advanced: {
        onBasePercentage: 0.376,
        sluggingPercentage: 0.58,
        ops: 0.956,
        war: null,
        opsPlus: null,
        eraPlus: null,
        fip: null,
      },
      achievements: null,
    },
    seasons: [{
      season: 2023,
      teamIds: ['LAA'],
      positions: { P: 23, DH: 135 },
      batting: {
        atBats: 497,
        runs: 102,
        hits: 151,
        doubles: 26,
        triples: 8,
        homeRuns: 44,
        runsBattedIn: 95,
        stolenBases: 20,
        walks: 91,
        battingAverage: 0.304,
        sluggingPercentage: 0.654,
      },
      pitching: {
        wins: 10,
        losses: 5,
        saves: 0,
        outsPitched: 396,
        hitsAllowed: 85,
        earnedRuns: 46,
        walksAllowed: 55,
        strikeouts: 167,
        earnedRunAverage: 3.14,
        whip: 1.06,
      },
      advanced: {
        onBasePercentage: 0.412,
        sluggingPercentage: 0.654,
        ops: 1.066,
        war: null,
        opsPlus: null,
        eraPlus: null,
        fip: null,
      },
      achievements: null,
    }],
    provenance: {
      canonicalUniversePresent: true,
      careerEnrichmentPresent: true,
      seasonCardCount: 1,
      legalNameExcludedFromDisplayPayload: true,
    },
  };
}
