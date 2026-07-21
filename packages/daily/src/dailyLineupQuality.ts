import type { Player } from '@initial-baseball/shared';

export const DAILY_LINEUP_ALGORITHM_VERSION = 'lineup-quality-v1';
export const DAILY_REPEAT_WINDOW_DAYS = 90;

export const DAILY_RECOGNIZABILITY_POLICY = [
  { slot: 1, maximumRank: 250 },
  { slot: 2, maximumRank: 250 },
  { slot: 3, maximumRank: 1000 },
  { slot: 4, maximumRank: 1000 },
  { slot: 5, maximumRank: 2500 },
  { slot: 6, maximumRank: 2500 },
  { slot: 7, maximumRank: 5000 },
  { slot: 8, maximumRank: 5000 },
  { slot: 9, maximumRank: 5000 },
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

export type DailyLineupSlotValidation = {
  slot: number;
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
      && candidate.recognizabilityRank <= policy.maximumRank
      && !selectedCanonicalIds.has(candidate.canonicalPlayerId)
      && !recentCanonicalIds.has(candidate.canonicalPlayerId)
    ));

    if (eligible.length === 0) {
      throw new Error(
        `Insufficient eligible Daily players for slot ${policy.slot} (top ${policy.maximumRank}).`,
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
    const warnings: DailyLineupWarning[] = [];

    if (selection === undefined || selection.canonicalPlayerId.length === 0) {
      warnings.push('missing-canonical-player');
    }

    const canonicalPlayerId = selection?.canonicalPlayerId ?? null;
    const recognizabilityRank = selection?.recognizabilityRank ?? null;
    const duplicate = canonicalPlayerId !== null && (counts.get(canonicalPlayerId) ?? 0) > 1;
    const lastDailyUsage = canonicalPlayerId === null ? null : latestUsage.get(canonicalPlayerId) ?? null;
    const recentUse = lastDailyUsage !== null;
    const revealReady = selection?.revealReady ?? false;

    if (duplicate) warnings.push('duplicate-canonical-player');
    if (recognizabilityRank === null) warnings.push('missing-recognizability-rank');
    if (recognizabilityRank !== null && recognizabilityRank > policy.maximumRank) {
      warnings.push('outside-recognizability-band');
    }
    if (recentUse) warnings.push('recently-used');
    if (!revealReady) warnings.push('missing-reveal-data');

    return {
      slot: policy.slot,
      expectedMaximumRank: policy.maximumRank,
      canonicalPlayerId,
      recognizabilityRank,
      duplicate,
      recentUse,
      lastDailyUsage,
      source: selection?.source ?? 'manual',
      revealReady,
      warnings,
    } satisfies DailyLineupSlotValidation;
  });

  return {
    valid: slots.every(slot => slot.warnings.length === 0),
    slots,
  };
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
