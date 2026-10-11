export type ChosenCustomNinePlayer = Readonly<{
  playerId: string;
  displayName: string;
  label: string;
}>;

export function appendCustomNinePlayer(
  players: readonly ChosenCustomNinePlayer[], candidate: ChosenCustomNinePlayer,
): readonly ChosenCustomNinePlayer[] {
  if (players.length >= 9 || !candidate.playerId.trim()
    || players.some(player => player.playerId === candidate.playerId)) return players;
  return [...players, candidate];
}

export function removeCustomNinePlayer(
  players: readonly ChosenCustomNinePlayer[], playerId: string,
): readonly ChosenCustomNinePlayer[] {
  return players.filter(player => player.playerId !== playerId);
}

export function moveCustomNinePlayer(
  players: readonly ChosenCustomNinePlayer[], index: number, direction: -1 | 1,
): readonly ChosenCustomNinePlayer[] {
  const to = index + direction;
  if (!Number.isInteger(index) || index < 0 || to < 0 || to >= players.length) return players;
  const next = [...players];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}

export function isCompleteCustomNineSelection(players: readonly ChosenCustomNinePlayer[]): boolean {
  return players.length === 9 && players.every(player => player.playerId.trim().length > 0)
    && new Set(players.map(player => player.playerId)).size === 9;
}
