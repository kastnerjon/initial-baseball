import type { Player } from '@initial-baseball/shared';
import generatedPlayers from './generated/players.json';
import generatedPitcherSaves from './generated/pitcher-saves.json';

export {
  applyPlayerAdminCorrection,
  buildPlayerAdminRecord,
  validatePlayerAdminCorrection,
  validatePlayerForAdmin,
  type PlayerAdminCorrection,
  type PlayerAdminPatch,
  type PlayerAdminRecord,
  type PlayerAdminValidationIssue,
} from './playerAdminRecords';

export type NormalizedPlayerRow = {
  externalSource: string;
  externalId: string;
  fullName: string;
  displayName: string;
  primaryRole: 'hitter' | 'pitcher' | 'two_way';
  primaryPosition: string;
  mainDecade: string;
  primaryTeam: string;
  teamsDisplay: string;
  dailyEligibilityTier: 'core' | 'extended' | 'none';
  dailyEligible: boolean;
};

const pitcherSaves = generatedPitcherSaves as Record<string, number>;
const generatedPlayerRows = generatedPlayers as unknown as Player[];
const displayNameOverrides: Readonly<Record<string, string>> = {
  'david americo ortiz arias': 'David Ortiz',
  'emmanuel de la cruz clase': 'Emmanuel Clase',
};
const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const surnameParticles = new Set(['da', 'de', 'del', 'della', 'der', 'di', 'dos', 'du', 'la', 'le', 'van', 'von']);

export function deriveBaseballDisplayName(player: Pick<Player, 'displayName' | 'fullName'>): string {
  const override = displayNameOverrides[normalizeName(player.fullName)]
    ?? displayNameOverrides[normalizeName(player.displayName)];

  if (override !== undefined) {
    return override;
  }

  const parts = player.displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 2) {
    return player.displayName.trim();
  }

  const firstName = parts[0];
  const suffix = parts[parts.length - 1];

  if (firstName === undefined || suffix === undefined) {
    return player.displayName.trim();
  }

  const hasSuffix = suffixes.has(suffix.toLocaleLowerCase());
  const surnameEndIndex = hasSuffix ? parts.length - 2 : parts.length - 1;
  let surnameStartIndex = surnameEndIndex;

  while (surnameStartIndex > 1) {
    const precedingPart = parts[surnameStartIndex - 1];

    if (precedingPart === undefined || !surnameParticles.has(precedingPart.toLocaleLowerCase())) {
      break;
    }

    surnameStartIndex -= 1;
  }

  return [
    firstName,
    ...parts.slice(surnameStartIndex, surnameEndIndex + 1),
    ...(hasSuffix ? [suffix] : []),
  ].join(' ');
}

function normalizePlayerDisplayName(player: Player): Player {
  const displayName = deriveBaseballDisplayName(player);

  if (displayName === player.displayName) {
    return player;
  }

  return {
    ...player,
    displayName,
    aliases: deduplicateNames([player.displayName, ...player.aliases], displayName, player.fullName),
  };
}

function deduplicateNames(names: string[], displayName: string, fullName: string): string[] {
  const reserved = new Set([normalizeName(displayName), normalizeName(fullName)]);
  const seen = new Set<string>();

  return names.filter((name) => {
    const normalized = normalizeName(name);

    if (normalized.length === 0 || reserved.has(normalized) || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function normalizeName(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export const baseballPlayers = generatedPlayerRows.map(normalizePlayerDisplayName).map((player) => {
  if (player.careerStats?.kind !== 'pitcher') {
    return player;
  }

  return {
    ...player,
    careerStats: {
      ...player.careerStats,
      stats: {
        ...player.careerStats.stats,
        SV: pitcherSaves[player.id] ?? 0,
      },
    },
  };
});
export const dailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligible);
export const coreDailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligibilityTier === 'core');
export const extendedDailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligibilityTier === 'extended');
