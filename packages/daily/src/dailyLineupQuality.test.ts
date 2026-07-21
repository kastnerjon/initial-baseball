import type { Player } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  DAILY_RECOGNIZABILITY_POLICY,
  generateDailyLineup,
  validateDailyLineup,
  type DailyLineupCandidate,
  type DailyLineupSelection,
} from './dailyLineupQuality';

describe('Daily lineup quality', () => {
  it('defines the approved nine-slot recognizability policy as sustainable bands', () => {
    expect(DAILY_RECOGNIZABILITY_POLICY.map(({ minimumRank, maximumRank }) => [minimumRank, maximumRank])).toEqual([
      [1, 250], [1, 250], [251, 1000], [251, 1000], [1001, 2500], [1001, 2500],
      [2501, 5000], [2501, 5000], [2501, 5000],
    ]);
  });

  it('is deterministic for the same date and reviewed versions', () => {
    const input = { seed: { dailyDate: '2026-07-21', reviewedDataVersion: 'data-v1' }, candidates: buildCandidates(5000) };
    expect(generateDailyLineup(input)).toEqual(generateDailyLineup(input));
  });

  it('changes seed context when the date or reviewed version changes', () => {
    const candidates = buildCandidates(5000);
    const base = generateDailyLineup({ seed: { dailyDate: '2026-07-21', reviewedDataVersion: 'data-v1' }, candidates });
    const changedDate = generateDailyLineup({ seed: { dailyDate: '2026-07-22', reviewedDataVersion: 'data-v1' }, candidates });
    const changedVersion = generateDailyLineup({ seed: { dailyDate: '2026-07-21', reviewedDataVersion: 'data-v2' }, candidates });
    expect(changedDate.map(x => x.canonicalPlayerId)).not.toEqual(base.map(x => x.canonicalPlayerId));
    expect(changedVersion.map(x => x.canonicalPlayerId)).not.toEqual(base.map(x => x.canonicalPlayerId));
  });

  it('honors exact rank bands and canonical uniqueness', () => {
    const lineup = generateDailyLineup({ seed: { dailyDate: '2026-07-21', reviewedDataVersion: 'v1' }, candidates: buildCandidates(5000) });
    expect(new Set(lineup.map(x => x.canonicalPlayerId)).size).toBe(9);
    lineup.forEach((selection, index) => {
      const policy = DAILY_RECOGNIZABILITY_POLICY[index];
      if (policy === undefined) throw new Error(`Missing policy for slot ${index + 1}.`);
      expect(selection.recognizabilityRank).toBeGreaterThanOrEqual(policy.minimumRank);
      expect(selection.recognizabilityRank).toBeLessThanOrEqual(policy.maximumRank);
    });
  });

  it('excludes players used from 1 through exactly 90 days ago, but not 91 days ago', () => {
    const candidates = buildCandidates(5000);
    const blocked = candidates[0];
    const available = candidates[1];
    if (!blocked || !available) throw new Error('Expected candidates.');
    const lineup = generateDailyLineup({
      seed: { dailyDate: '2026-07-21', reviewedDataVersion: 'v1' },
      candidates,
      usageHistory: [
        { canonicalPlayerId: blocked.canonicalPlayerId, dailyDate: '2026-04-22' },
        { canonicalPlayerId: available.canonicalPlayerId, dailyDate: '2026-04-21' },
      ],
    });
    expect(lineup.some(x => x.canonicalPlayerId === blocked.canonicalPlayerId)).toBe(false);
  });

  it('returns stable structured validation for manual warnings', () => {
    const candidates = buildManualSelections();
    const duplicate = candidates[1];
    const first = candidates[0];
    if (!duplicate || !first) throw new Error('Expected candidates.');
    duplicate.canonicalPlayerId = first.canonicalPlayerId;
    candidates[2] = { ...candidates[2]!, recognizabilityRank: null };
    candidates[3] = { ...candidates[3]!, recognizabilityRank: 1001 };
    candidates[4] = { ...candidates[4]!, revealReady: false };
    const result = validateDailyLineup('2026-07-21', candidates, [
      { canonicalPlayerId: candidates[5]!.canonicalPlayerId, dailyDate: '2026-07-20' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.slots[0]?.warnings).toContain('duplicate-canonical-player');
    expect(result.slots[2]?.warnings).toContain('missing-recognizability-rank');
    expect(result.slots[3]?.warnings).toContain('outside-recognizability-band');
    expect(result.slots[4]?.warnings).toContain('missing-reveal-data');
    expect(result.slots[5]?.lastDailyUsage).toBe('2026-07-20');
    expect(result).toEqual(validateDailyLineup('2026-07-21', candidates, [
      { canonicalPlayerId: candidates[5]!.canonicalPlayerId, dailyDate: '2026-07-20' },
    ]));
  });

  it('rejects extra, duplicate, and out-of-range slots', () => {
    const base = buildManualSelections();
    const extra = { ...base[0]!, slot: 10 };
    const extraResult = validateDailyLineup('2026-07-21', [...base, extra]);
    expect(extraResult.valid).toBe(false);
    expect(extraResult.warnings).toEqual(['incorrect-selection-count', 'out-of-range-slot']);

    const duplicateSlot = base.map(selection => ({ ...selection }));
    duplicateSlot[8] = { ...duplicateSlot[8]!, slot: 8 };
    const duplicateResult = validateDailyLineup('2026-07-21', duplicateSlot);
    expect(duplicateResult.valid).toBe(false);
    expect(duplicateResult.warnings).toEqual(['duplicate-slot']);
  });

  it('fails clearly when a slot pool is insufficient', () => {
    expect(() => generateDailyLineup({
      seed: { dailyDate: '2026-07-21', reviewedDataVersion: 'v1' },
      candidates: buildCandidates(1),
    })).toThrow('Insufficient eligible Daily players for slot 2');
  });
});

function buildManualSelections(): DailyLineupSelection[] {
  return DAILY_RECOGNIZABILITY_POLICY.map((policy, index) => ({
    canonicalPlayerId: `canonical:${index + 1}`,
    player: buildPlayer(index + 1),
    recognizabilityRank: policy.minimumRank,
    revealReady: true,
    slot: policy.slot,
    source: 'manual',
  }));
}

function buildCandidates(count: number): DailyLineupCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    canonicalPlayerId: `canonical:${index + 1}`,
    player: buildPlayer(index + 1),
    recognizabilityRank: index + 1,
    revealReady: true,
  }));
}

function buildPlayer(index: number): Player {
  return {
    id: `legacy:${index}`,
    fullName: `Player ${index}`,
    displayName: `Player ${index}`,
    primaryRole: 'hitter',
    primaryPosition: '1B',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'NYY',
    teamsDisplay: 'NYY',
    statsLine: '—',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
  };
}
