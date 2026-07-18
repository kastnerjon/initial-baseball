import { describe, expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { deriveBaseballDisplayName } from './index';
import {
  applyPlayerAdminCorrection,
  buildPlayerAdminRecord,
  validatePlayerAdminCorrection,
  type PlayerAdminCorrection,
} from './playerAdminRecords';

describe('player admin records', () => {
  it('applies an auditable display-name and alias correction', () => {
    const corrected = applyPlayerAdminCorrection(buildPlayer(), buildCorrection({
      displayName: 'Ken Griffey Jr.',
      aliases: ['Junior', 'Ken Griffey Jr.'],
    }));

    expect(corrected.displayName).toBe('Ken Griffey Jr.');
    expect(corrected.aliases).toEqual(['Junior']);
  });

  it('rejects duplicate aliases after normalization', () => {
    const issues = validatePlayerAdminCorrection(buildPlayer(), buildCorrection({
      aliases: ['Junior', 'junior'],
    }));

    expect(issues).toContainEqual({
      field: 'aliases',
      message: 'Aliases must not contain duplicates.',
    });
  });

  it('keeps eligibility fields synchronized', () => {
    const corrected = applyPlayerAdminCorrection(buildPlayer(), buildCorrection({
      dailyEligibilityTier: 'none',
    }));

    expect(corrected.dailyEligibilityTier).toBe('none');
    expect(corrected.dailyEligible).toBe(false);
  });

  it('reformats displayed career years after a year correction', () => {
    const corrected = applyPlayerAdminCorrection(buildPlayer(), buildCorrection({
      firstYear: 1999,
      lastYear: 2010,
    }));

    expect(corrected.yearsPlayedDisplay).toBe('1999–2010');
  });

  it('rejects a correction for a different canonical player', () => {
    const issues = validatePlayerAdminCorrection(buildPlayer(), {
      ...buildCorrection({ displayName: 'Wrong Player' }),
      playerId: 'another-player',
    });

    expect(issues).toContainEqual({
      field: 'playerId',
      message: 'Correction playerId does not match the selected player.',
    });
  });

  it('rejects impossible career ranges', () => {
    const issues = validatePlayerAdminCorrection(buildPlayer(), buildCorrection({
      firstYear: 2015,
      lastYear: 2010,
    }));

    expect(issues).toContainEqual({
      field: 'firstYear',
      message: 'First year cannot be later than last year.',
    });
  });

  it('builds an admin record with current validation issues', () => {
    const record = buildPlayerAdminRecord({
      ...buildPlayer(),
      displayName: '',
    });

    expect(record.validationIssues).toContainEqual({
      field: 'displayName',
      message: 'Display name is required.',
    });
  });
});

describe('baseball display names', () => {
  it('keeps familiar two-part baseball names', () => {
    expect(deriveBaseballDisplayName({ fullName: 'Henry Louis Aaron', displayName: 'Hank Aaron' })).toBe('Hank Aaron');
    expect(deriveBaseballDisplayName({ fullName: 'Markus Lynn Betts', displayName: 'Mookie Betts' })).toBe('Mookie Betts');
  });

  it('uses the approved David Ortiz override', () => {
    expect(deriveBaseballDisplayName({
      fullName: 'David Américo Ortiz Arias',
      displayName: 'David Américo Ortiz Arias',
    })).toBe('David Ortiz');
  });

  it('removes ordinary middle names while preserving suffixes', () => {
    expect(deriveBaseballDisplayName({
      fullName: 'George Kenneth Griffey Jr.',
      displayName: 'George Kenneth Griffey Jr.',
    })).toBe('George Griffey Jr.');
  });

  it('preserves recognized multi-word surnames', () => {
    expect(deriveBaseballDisplayName({
      fullName: 'Example de la Cruz',
      displayName: 'Example de la Cruz',
    })).toBe('Example de la Cruz');
  });
});

function buildCorrection(patch: PlayerAdminCorrection['patch']): PlayerAdminCorrection {
  return {
    playerId: 'player-1',
    patch,
    reason: 'Correct the canonical player record.',
    editedBy: 'admin@example.com',
    editedAt: '2026-07-18T21:00:00.000Z',
  };
}

function buildPlayer(): Player {
  return {
    id: 'player-1',
    fullName: 'George Kenneth Griffey Jr.',
    displayName: 'George Kenneth Griffey Jr.',
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '1990s',
    firstYear: 1989,
    lastYear: 2010,
    yearsPlayedDisplay: '1989–2010',
    primaryTeam: 'SEA',
    teamsDisplay: 'SEA, CIN, CWS',
    statsLine: '—',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}
