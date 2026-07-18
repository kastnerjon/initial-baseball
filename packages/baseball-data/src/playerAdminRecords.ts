import type { Player, PlayerRole } from '@initial-baseball/shared';

export type PlayerAdminPatch = {
  displayName?: string;
  fullName?: string;
  aliases?: string[];
  primaryRole?: PlayerRole;
  primaryPosition?: string;
  firstYear?: number | null;
  lastYear?: number | null;
  primaryTeam?: string;
  teamsDisplay?: string;
  dailyEligibilityTier?: Player['dailyEligibilityTier'];
};

export type PlayerAdminCorrection = {
  playerId: string;
  patch: PlayerAdminPatch;
  reason: string;
  editedBy: string;
  editedAt: string;
};

export type PlayerAdminValidationIssue = {
  field: keyof PlayerAdminPatch | 'playerId' | 'reason' | 'editedBy' | 'editedAt';
  message: string;
};

export type PlayerAdminRecord = {
  player: Player;
  pendingCorrection: PlayerAdminCorrection | null;
  validationIssues: PlayerAdminValidationIssue[];
};

export function buildPlayerAdminRecord(
  player: Player,
  pendingCorrection: PlayerAdminCorrection | null = null,
): PlayerAdminRecord {
  const validationIssues = pendingCorrection === null
    ? validatePlayerForAdmin(player)
    : validatePlayerAdminCorrection(player, pendingCorrection);

  return {
    player,
    pendingCorrection,
    validationIssues,
  };
}

export function applyPlayerAdminCorrection(
  player: Player,
  correction: PlayerAdminCorrection,
): Player {
  const issues = validatePlayerAdminCorrection(player, correction);

  if (issues.length > 0) {
    throw new Error(`Invalid player correction: ${issues.map((issue) => issue.message).join(' ')}`);
  }

  const patchedPlayer: Player = {
    ...player,
    ...correction.patch,
  };

  const tier = correction.patch.dailyEligibilityTier ?? player.dailyEligibilityTier;

  return {
    ...patchedPlayer,
    aliases: deduplicateAliases(patchedPlayer.aliases, patchedPlayer.displayName, patchedPlayer.fullName),
    dailyEligibilityTier: tier,
    dailyEligible: tier !== 'none',
    yearsPlayedDisplay: formatCareerYears(patchedPlayer.firstYear, patchedPlayer.lastYear),
  };
}

export function validatePlayerAdminCorrection(
  player: Player,
  correction: PlayerAdminCorrection,
): PlayerAdminValidationIssue[] {
  const issues: PlayerAdminValidationIssue[] = [];

  if (correction.playerId !== player.id) {
    issues.push({ field: 'playerId', message: 'Correction playerId does not match the selected player.' });
  }

  if (correction.reason.trim().length < 5) {
    issues.push({ field: 'reason', message: 'A brief reason is required for every correction.' });
  }

  if (correction.editedBy.trim().length === 0) {
    issues.push({ field: 'editedBy', message: 'The editor identity is required.' });
  }

  if (Number.isNaN(Date.parse(correction.editedAt))) {
    issues.push({ field: 'editedAt', message: 'editedAt must be a valid timestamp.' });
  }

  const candidate: Player = {
    ...player,
    ...correction.patch,
    dailyEligible: (correction.patch.dailyEligibilityTier ?? player.dailyEligibilityTier) !== 'none',
  };

  issues.push(...validatePlayerForAdmin(candidate));

  if (correction.patch.aliases !== undefined) {
    const normalizedAliases = correction.patch.aliases.map(normalizeName);
    const duplicateAlias = normalizedAliases.find((alias, index) => normalizedAliases.indexOf(alias) !== index);

    if (duplicateAlias !== undefined) {
      issues.push({ field: 'aliases', message: 'Aliases must not contain duplicates.' });
    }
  }

  return issues;
}

export function validatePlayerForAdmin(player: Player): PlayerAdminValidationIssue[] {
  const issues: PlayerAdminValidationIssue[] = [];

  if (player.displayName.trim().length === 0) {
    issues.push({ field: 'displayName', message: 'Display name is required.' });
  }

  if (player.fullName.trim().length === 0) {
    issues.push({ field: 'fullName', message: 'Full name is required.' });
  }

  if (player.primaryPosition.trim().length === 0) {
    issues.push({ field: 'primaryPosition', message: 'Primary position is required.' });
  }

  if (player.firstYear !== null && player.lastYear !== null && player.firstYear > player.lastYear) {
    issues.push({ field: 'firstYear', message: 'First year cannot be later than last year.' });
  }

  if (player.dailyEligible !== (player.dailyEligibilityTier !== 'none')) {
    issues.push({
      field: 'dailyEligibilityTier',
      message: 'Daily eligibility must agree with the eligibility tier.',
    });
  }

  return issues;
}

function deduplicateAliases(aliases: string[], displayName: string, fullName: string): string[] {
  const reservedNames = new Set([normalizeName(displayName), normalizeName(fullName)]);
  const seenAliases = new Set<string>();

  return aliases.filter((alias) => {
    const normalizedAlias = normalizeName(alias);

    if (normalizedAlias.length === 0 || reservedNames.has(normalizedAlias) || seenAliases.has(normalizedAlias)) {
      return false;
    }

    seenAliases.add(normalizedAlias);
    return true;
  });
}

function normalizeName(value: string): string {
  return value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function formatCareerYears(firstYear: number | null, lastYear: number | null): string {
  if (firstYear === null && lastYear === null) {
    return 'Unknown';
  }

  if (firstYear === null) {
    return `Through ${lastYear}`;
  }

  if (lastYear === null) {
    return `${firstYear}–Present`;
  }

  return firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`;
}
