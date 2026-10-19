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
      pri¶»§q«^