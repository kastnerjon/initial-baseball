import { generateInitials } from '@initial-baseball/engine';
import type { DailyPuzzle, Player, PlayerIdentity } from '@initial-baseball/shared';
import { buildDefaultDailyHints } from './buildDefaultDailyHints';
import type { DemoDailyPitch, DemoPitchHint } from './mockDailyPuzzle';

export function createGamePitchesFromPuzzle(puzzle: DailyPuzzle): DemoDailyPitch[] {
  return puzzle.pitches.map((pitch) => ({
    pitchNumber: pitch.pitchNumber,
    player: pitch.player,
    hints: buildHintsFromHintSet(pitch.hints),
    correctPlayerId: pitch.player.playerId,
  }));
}

export function createDailyPuzzlePitch(pitchNumber: number, player: Player): DailyPuzzle['pitches'][number] {
  return {
    pitchNumber,
    player: createPlayerIdentity(player),
    hints: buildHintSet(buildDefaultDailyHints(player)),
  };
}

export function createPlayerIdentity(player: Player): PlayerIdentity {
  return {
    playerId: player.id,
    fullName: player.fullName,
    displayName: player.displayName,
    // Preserve the existing engine initials behavior for Daily, including suffix handling like KGJ for now.
    initials: generateInitials(player.displayName || player.fullName),
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

function buildHintsFromHintSet(hints: DailyPuzzle['pitches'][number]['hints']): DemoPitchHint[] {
  return buildDefaultDailyHints({
    id: '',
    fullName: '',
    displayName: '',
    primaryRole: 'hitter',
    primaryPosition: hints.position ?? 'Unknown',
    mainDecade: hints.main_decade ?? 'Unknown',
    primaryTeam: '',
    teamsDisplay: hints.teams ?? '',
    statsLine: hints.stats ?? '',
    dailyEligibilityTier: 'none',
    dailyEligible: false,
    aliases: [],
  });
}
