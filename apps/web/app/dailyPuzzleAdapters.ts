import { generateInitials } from '@initial-baseball/engine';
import type { DailyPuzzle, Player, PlayerIdentity } from '@initial-baseball/shared';
import { buildDefaultDailyHints } from './buildDefaultDailyHints';

// Beta dates before this rollout keep the initials players originally saw.
export const TERMINAL_SUFFIX_INITIALS_START_DATE = '2026-09-28';

export function createDailyPuzzlePitch(
  pitchNumber: number,
  player: Player,
  puzzleDate?: string,
): DailyPuzzle['pitches'][number] {
  return {
    pitchNumber,
    player: createPlayerIdentity(player, puzzleDate),
    hints: buildHintSet(buildDefaultDailyHints(player)),
  };
}

export function createPlayerIdentity(player: Player, puzzleDate?: string): PlayerIdentity {
  return {
    playerId: player.id,
    fullName: player.fullName,
    displayName: player.displayName,
    // Historical beta puzzles retain the initials generated before this rollout.
    initials: generateInitials(
      player.displayName || player.fullName,
      puzzleDate !== undefined && puzzleDate < TERMINAL_SUFFIX_INITIALS_START_DATE
        ? 'include'
        : 'omit',
    ),
    kind: derivePlayerKind(player),
    primaryPosition: player.primaryPosition,
  };
}

function derivePlayerKind(player: Player): PlayerIdentity['kind'] {
  if (player.primaryRole === 'pitcher' || player.primaryRole === 'hitter') {
    return player.primaryRole;
  }

  return player.primaryPosition === 'P' ? 'pitcher' : 'hitter';
}

function buildHintSet(hints: DemoPitchHint[]): DailyPuzzle['pitches'][number]['hints'] {
  return hints.reduce<DailyPuzzle['pitches'][number]['hints']>((hintSet, hint) => {
    hintSet[hint.hintType] = hint.hintValue;
    return hintSet;
  }, {});
}

type DemoPitchHint = ReturnType<typeof buildDefaultDailyHints>[number];
