import { describe, expect, it } from 'vitest';
import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import { normalizeCanonicalRevealViewModel } from './normalizeCanonicalRevealViewModel';

describe('normalizeCanonicalRevealViewModel', () => {
  it('migrates the former single-line saved reveal shape', () => {
    const legacyReveal = {
      playerId: 'ibp_griffey',
      displayName: 'Ken Griffey Jr.',
      playerType: 'hitter',
      primaryPosition: 'CF',
      yearsPlayedDisplay: '1989–2010',
      teamIds: ['SEA', 'CIN', 'CHA'],
      career: {
        kind: 'hitter',
        stats: { HR: 630, OPS: '.908' },
      },
      seasons: [{
        season: 1997,
        teamIds: ['SEA'],
        kind: 'hitter',
        stats: { HR: 56, OPS: '1.028' },
      }],
    } as unknown as CanonicalRevealViewModel;

    const normalized = normalizeCanonicalRevealViewModel(legacyReveal);

    expect(normalized.career.lines).toEqual([
      { kind: 'hitter', stats: { HR: 630, OPS: '.908' } },
    ]);
    expect(normalized.seasons[0]?.lines).toEqual([
      { kind: 'hitter', stats: { HR: 56, OPS: '1.028' } },
    ]);
  });

  it('leaves the current multi-line shape intact', () => {
    const reveal: CanonicalRevealViewModel = {
      playerId: 'ibp_ohtani',
      displayName: 'Shohei Ohtani',
      playerType: 'two-way',
      primaryPosition: 'P',
      yearsPlayedDisplay: '2018–2026',
      teamIds: ['LAA', 'LAD'],
      career: {
        lines: [
          { kind: 'hitter', stats: { HR: 225 } },
          { kind: 'pitcher', stats: { W: 80 } },
        ],
      },
      seasons: [],
    };

    expect(normalizeCanonicalRevealViewModel(reveal)).toEqual(reveal);
  });
});
