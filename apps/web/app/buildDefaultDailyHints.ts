import type { HintType, Player } from '@initial-baseball/shared';

export type DefaultDailyHint = {
  hintType: HintType;
  hintLabel: string;
  hintValue: string;
};

const DEFAULT_DAILY_HINT_ORDER: Array<{
  hintType: HintType;
  hintLabel: string;
}> = [
  { hintType: 'main_decade', hintLabel: 'Main Decade' },
  { hintType: 'teams', hintLabel: 'Teams' },
  { hintType: 'position', hintLabel: 'Position' },
  { hintType: 'stats', hintLabel: 'Stats' },
];

export function buildDefaultDailyHints(player: Player): DefaultDailyHint[] {
  return DEFAULT_DAILY_HINT_ORDER.map(({ hintType, hintLabel }) => ({
    hintType,
    hintLabel,
    hintValue: getHintValue(hintType, player),
  }));
}

function getHintValue(hintType: HintType, player: Player): string {
  switch (hintType) {
    case 'main_decade':
      return player.mainDecade && player.mainDecade !== 'Unknown' ? player.mainDecade : 'Unknown';
    case 'teams':
      return player.teamsDisplay.trim() ? player.teamsDisplay : 'Teams unavailable';
    case 'position':
      return player.primaryPosition && player.primaryPosition !== 'Unknown' ? player.primaryPosition : 'Unknown';
    case 'stats':
      return player.statsLine.trim() ? player.statsLine : 'Stats unavailable';
    default:
      return 'Unknown';
  }
}
