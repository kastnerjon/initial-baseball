import type { Player } from '@initial-baseball/shared';

export type RandomNumberGenerator = () => number;

export function selectRandomPracticePlayer(players: Player[], rng: RandomNumberGenerator = Math.random): Player {
  if (players.length === 0) {
    throw new Error('Cannot select a practice player from an empty player list.');
  }

  const index = Math.min(players.length - 1, Math.floor(rng() * players.length));
  const player = players[index];

  if (!player) {
    throw new Error('Practice player selection produced an invalid player index.');
  }

  return player;
}
