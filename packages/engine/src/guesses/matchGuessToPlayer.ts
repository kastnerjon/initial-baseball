import type { Player } from '@initial-baseball/shared';
import { normalizeGuess } from './normalizeGuess.js';

export function matchGuessToPlayer(guess: string, player: Player): boolean {
  const normalizedGuess = normalizeGuess(guess);
  if (!normalizedGuess) return false;

  const acceptedAnswers = [player.fullName, player.displayName, ...player.aliases].map(normalizeGuess);
  return acceptedAnswers.includes(normalizedGuess);
}
