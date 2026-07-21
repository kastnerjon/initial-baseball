import type { Player } from '@initial-baseball/shared';

export const DAILY_LINEUP_ALGORITHM_VERSION = 'lineup-quality-v2';
export const DAILY_REPEAT_WINDOW_DAYS = 90;

export const DAILY_RECOGNIZABILITY_POLICY = [
  { slot: 1, minimumRank: 1, maximumRank: 250 },
  { slot: 2, minimumRank: 1, maximumRank: 250 },
  { slot: 3, minimumRank: 251, maximumRank: 1000 },
  { slot: 4, minimumRank: 251, maximumRank: 1000 },
  { slot: 5, minimumRank: 1001, maximumRank: 2500 },
  { slot: 6, minimumRank: 1001, maximumRank: 2500 },
  { slot: 7, minimumRank: 2501, maximumRank: 5000 },
  { slot: 8, minimumRank: 2501, maximumRank: 5000 },
  { slot: 9, minimumRank: 2501, maximumRank: 5000 },
] as const;

export type DailyLineupSelectionSource = 'generated' | 'manual';

export type DailyLineupSeedContext = {
  dailyDate: string;
  reviewedDataVersion: string;
  algorithmVersion?: string;
};

export type DailyPlayerUsage = {
  canonicalPlayerId: string;
  dailyDate: string;
};

export type DailyLineupCandidate = {
  canonicalPlayerId: string;
  player: Player;
  recognizabilityRank: number | null;
  revealReady: boolean;
};

export type DailyLineupSelection = DailyLineupCandidate & {
  slot: number;
  source: DailyLineupSelectionSource;
};

export type DailyLineupWarning =
  | 'duplicate-canonical-player'
  | 'missing-canonical-player'
  | 'missing-recognizability-rank'
  | 'outside-recognizability-band'
  | 'recently-used'
  | 'missing-reveal-data';

export type DailyLineupValidationWarning =
  | 'incorrect-selection-count'
  | 'duplicate-slot'
  | 'out-of-range-slot';

export type DailyLineupSlotValidation = {
  slot: number;
  expectedMinimumRank: number;
  expectedMaximumRank: number;
  canonicalPlayerId: string | null;
  recognizabilityRank: number | null;
  duplicate: boolean;
  recentUse: boolean;
  lastDailyUsage: string | null;
  source: DailyLineupSelectionSource;
  revealReady: boolean;
  warnings: readonly DailyLineupWarning[];
};

export type DailyLineupValidation = {
  valid: boolean;
  warnings: readonly DailyLineupValidationWarning[];
  slots: readonly DailyLineupSlotValidation[];
};

export type GenerateDailyLineupInput = {
  seed: DailyLineupSeedContext;
  candidates: readonly DailyLineupCandidate[];
  usageHistory?: readonly DailyPlayerUsage[];
};

export function generateDailyLineup({
  seed,
  candidates,
  usageHistory = [],
}: GenerateDailyLineupInput): DailyLineupSelection[] {
  const recentCanonicalIds = getRecentCanonicalIds(seed.dailyDate, usageHistory);
  const selectedCanonicalIds = new Set<string>();
  const selections: DailyLineupSelection[] = [];

  for (const policy of DAILY_RECOGNIZABILITY_POLICY) {
    const eligible = candidates.filter(candidate => (
      candidate.recognizabilityRank !== null
      && candidate.recognizabilityRank >= policy.minimumRank
      && candidate.recognizabilityRank <= policy.maximumRank
      && !selectedCanonicalIds.has(candidate.canonicalPlayerId)
      && !recentCanonicalIds.has(candidate.canonicalPlayerId)
    ));

    if (eligible.length === 0) {
      throw new Error(
        `Insufficient eligible Daily players for slot ${policy.slot} (ranks ${policy.minimumRank}-${policy.maximumRank}).`,
      );
    }

    const selected = [...eligible].sort((left, right) => (
      compareHashedValues(
        buildSeed(seed, policy.slot, left.canonicalPlayerId),
        buildSeed(seed, policy.slot, right.canonicalPlayerId),
      )
      || left.canonicalPlayerId.localeCompare(right.canonicalPlayerId)
    ))[0];

    if (selected === undefined) {
      throw new Error(`Could not select Daily player for slot ${policy.slot}.`);
    }

    selections.push({ ...selected, slot: policy.slot, source: 'generated' });
    selectedCanonicalIds.add(selected.canonicalPlayerId);
  }

  return selections;
}

export function validateDailyLineup(
  dailyDate: string,
  selections: readonly DailyLineupSelection[],
  usageHistory: readonly DailyPlayerUsage[] = [],
): DailyLineupValidation {
  const warnings = validateLineupShape(selections);
  const counts = new Map<string, number>();
  for (const selection of selections) {
    counts.set(
      selection.canonicalPlayerId,
      (counts.get(selection.canonicalPlayerId) ?? 0) + 1,
    );
  }

  const latestUsage = getLatestUsageByCanonicalId(dailyDate, usageHistory);
  const slots = DAILY_RECOGNIZABILITY_POLICY.map((policy) => {
    const selection = selections.find(candidate => candidate.slot === policy.slot);
    const slotWarnings: DailyLineupWarning[] = [];

    if (selection === undefined || selection.canonicalPlayerId.length === 0) {
      slotWarnings.push('missing-canonical-player');
    }

    const canonicalPlayerId = selection?.canonicalPlayerId ?? null;
    const recognizabilityRank = selection?.recognizabilityRank ?? null;
    const duplicate = canonicalPlayerId !== null && (counts.get(canonicalPlayerId) ?? 0) > 1;
    const lastDailyUsage = canonicalPlayerId === null ? null : latestUsage.get(canonicalPlayerId) ?? null;
    const recentUse = lastDailyUsage !== null;
    const revealReady = selection?.revealReady ?? false;

    if (duplicate) slotWarnings.push('duplicate-canonical-player');
    if (recognizabilityRank === null) slotWarnings.push('missing-recognizability-rank');
    if (
      recognizabilityRank !== null
      && (recognizabilityRank < policy.minimumRank || recognizabilityRank > policy.maximumRank)
    ) {
      slotWarnings.push('outside-recognizability-band');
    }
    if (recentUse) slotWarnings.push('recently-used');
    if (!revealReady) slotWarnings.push('missing-reveal-data');

    return {
      slot: policy.slot,
      expectedMinimumRank: policy.minimumRank,
      expectedMaximumRank: policy.maximumRank,
      canonicalPlayerId,
      recognizabilityRank,
      duplicate,
      recentUse,
      lastDailyUsage,
      source: selection?.source ?? 'manual',
      revealReady,
      warnings: slotWarnings,
    } satisfies DailyLineupSlotValidation;
  });

  return {
    valid: warnings.length === 0 && slots.every(slot => slot.warnings.length === 0),
    warnings,
    slots,
  };
}

function validateLineupShape(
  selections: readonly DailyLineupSelection[],
): DailyLineupValidationWarning[] {
  const warnings: DailyLineupValidationWarning[] = [];
  if (selections.length !== DAILY_RECOGNIZABILITY_POLICY.length) {
    warnings.push('incorrect-selection-count');
  }

  const validSlots = new Set(DAILY_RECOGNIZABILITY_POLICY.map(policy => policy.slot));
  const selectedSlots = selections.map(selection => selection.slot);
  if (new Set(selectedSlots).size !== selectedSlots.length) warnings.push('duplicate-slot');
  if (selectedSlots.some(slot => !validSlots.has(slot as never))) warnings.push('out-of-range-slot');
  return warnings;
}

function getRecentCanonicalIds(
  dailyDate: string,
  usageHistory: readonly DailyPlayerUsage[],
): Set<string> {
  return new Set(getLatestUsageByCanonicalId(dailyDate, usageHistory).keys());
}

function getLatestUsageByCanonicalId(
  dailyDate: string,
  usageHistory: readonly DailyPlayerUsage[],
): Map<string, string> {
  const latestUsage = new Map<string, string>();
  for (const usage of usageHistory) {
    const ageDays = getDaysBetween(usage.dailyDate, dailyDate);
    if (ageDays < 1 || ageDays > DAILY_REPEAT_WINDOW_DAYS) continue;

    const current = latestUsage.get(usage.canonicalPlayerId);
    if (current === undefined || usage.dailyDate > current) {
      latestUsage.set(usage.canonicalPlayerId, usage.dailyDate);
    }
  }
  return latestUsage;
}

function buildSeed(
  seed: DailyLineupSeedContext,
  slot: number,
  canonicalPlayerId: string,
): string {
  return [
    seed.dailyDate,
    seed.reviewedDataVersion,
    seed.algorithmVersion ?? DAILY_LINEUP_ALGORITHM_VERSION,
    slot,
    canonicalPlayerId,
  ].join(':');
}

function compareHashedValues(left: string, right: string): number {
  return hashString(left) - hashString(right);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getDaysBetween(earlierDate: string, laterDate: string): number {
  return Math.floor((parseDate(laterDate) - parseDate(earlierDate)) / 86400000);
}

function parseDate(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid Daily date: ${value}.`);
  return timestamp;
}
