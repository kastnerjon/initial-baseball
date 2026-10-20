export type ChosenCustomNinePlayer = Readonly<{
  playerId: string;
  displayName: string;
  label: string;
}>;

export function appendCustomNinePlayer(
  players: readonly ChosenCustomNinePlayer[], candidate: ChosenCustomNinePlayer,
  maximumPlayers = 9,
): readonly ChosenCustomNinePlayer[] {
  if (players.length >= maximumPlayers || !candidate.playerId.trim()
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
  return isValidUniqueSelection(players) && players.length === 9;
}

/** Only the new v2 creator accepts 1–10 ordered, distinct canonical selections. */
export function isCompleteCustomLineupSelection(players: readonly ChosenCustomNinePlayer[]): boolean {
  return players.length >= 1 && players.length <= 10 && isValidUniqueSelection(players);
}

function isValidUniqueSelection(players: readonly ChosenCustomNinePlayer[]): boolean {
  return players.every(player => player.playerId.trim().length > 0)
    && new Set(players.map(player => player.playerId)).size === players.length;
}

/** An issued immutable challenge stays visible until the creator explicitly starts again. */
export function isCustomNineDraftEditable(issuedId: string | null, issuing: boolean): boolean {
  return issuedId === null && !issuing;
}

/** Each Custom v2 array entry corresponds to one visible numbered batting spot. */
export type CustomLineupSlots = readonly (ChosenCustomNinePlayer | null)[];

export function resizeCustomLineupSlots(slots: CustomLineupSlots, length: number): CustomLineupSlots {
  if (!Number.isInteger(length) || length < 1 || length > 10) return slots;
  return Array.from({ length }, (_, i) => slots[i] ?? null);
}

export function chooseCustomLineupSlot(slots: CustomLineupSlots, index: number, player: ChosenCustomNinePlayer): CustomLineupSlots {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length || !player.playerId.trim()
    || slots.some((existing, i) => i !== index && existing?.playerId === player.playerId)) return slots;
  const next = [...slots];
  next[index] = player;
  return next;
}

export function swapCustomLineupSlots(slots: CustomLineupSlots, first: number, second: number): CustomLineupSlots {
  if (!Number.isInteger(first) || !Number.isInteger(second) || first < 0 || second < 0
    || first >= slots.length || second >= slots.length || first === second) return slots;
  const next = [...slots];
  [next[first], next[second]] = [next[second]!, next[first]!];
  return next;
}

export function isCompleteCustomLineupSlots(slots: CustomLineupSlots): boolean {
  return slots.length >= 1 && slots.length <= 10
    && slots.every(player => player !== null && player.playerId.trim().length > 0)
    && new Set(slots.map(player => player?.playerId)).size === slots.length;
}
