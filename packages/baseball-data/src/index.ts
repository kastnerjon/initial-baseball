import type { Player } from '@initial-baseball/shared';
import generatedPlayers from './generated/players.json';
import generatedPitcherSaves from './generated/pitcher-saves.json';
import generatedTeamHistoryOverrides from './generated/team-history-overrides.json';

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
const teamHistoryOverrides = generatedTeamHistoryOverrides as Record<string, string>;
const generatedPlayerRows = generatedPlayers as unknown as Player[];
const displayNameOverrides: Readonly<Record<string, string>> = {
  'david americo ortiz arias': 'David Ortiz',
};
const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const surnameParticles = new Set(['da', 'de', 'del', 'della', 'der', 'di', 'dos', 'du', 'la', 'le', 'van', 'von']);

export function deriveBaseballDisplayName(player: Pick<Player, 'display¶»§q«^