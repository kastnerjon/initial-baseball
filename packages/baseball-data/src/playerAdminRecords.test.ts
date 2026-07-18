import { describe, expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
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
      aliases: ['Junior', 'Ken Griffey Jr.', 'junior'],
    }));

    expect(corrected.displayName).toBe('Ken Griffey Jr.');
    expect(corrected.aliases).toEqual(['Junior']);
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
