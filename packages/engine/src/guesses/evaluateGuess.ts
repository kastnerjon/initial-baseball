export function evaluateGuess(submittedPlayerId: string | string[], correctPlayerId: string): boolean {
  if (Array.isArray(submittedPlayerId)) {
    return submittedPlayerId.includes(correctPlayerId);
  }

  return submittedPlayerId === correctPlayerId;
}
