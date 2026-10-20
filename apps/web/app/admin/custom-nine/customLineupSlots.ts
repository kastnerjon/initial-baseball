import type { ChosenCustomNinePlayer } from './customNineCreatorSelection';

export type CustomLineupSlot = ChosenCustomNinePlayer | null;

/** Numbered positions are authoritative; holes cannot be issued. */
export function isCompleteCustomLineupSlots(slots: readonly CustomLineupSlot[]): boolean {
  return slots.length >= 1 && slots.length <= 10
    && slots.every(player => player !== null && player.playerId.trim().length > 0)
    && new Set(slots.map(player => player?.playerId)).size === slots.length;
}

export function resizeCustomLineupSlots(
  slots: readonly CustomLineupSlot[], count: number,
): readonly CustomLineupSlot[] {
  if (!Number.isInteger(count) || count < 1 || count > 10) return slots;
  return Array.from({ length: count }, (_, index) => slots[index] ?? null);
}

export function chooseCustomLineupSlot(
  slots: readonly CustomLineupSlot[], index: number, player: ChosenCustomNinePlayer,
): readonly CustomLineupSlot[] {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length || !player.playerId.trim()
    || slots.some((current, i) => i !== index && current?.playerId === player.playerId)) return slots;
  const next = [...slots];
  next[index] = player;
  return next;
}

export function swapCustomLineupSlots(
  slots: readonly CustomLineupSlot[], source: number, destination: number,
): readonly CustomLineupSlot[] {
  if (!Number.isInteger(source) || !Number.isInteger(destination)
    || source < 0 || destination < 0 || source >= slots.length || destination >= slots.length
    || source === destination || !slots[source] || !slots[destination]) return slots;
  const next = [...slots];
  next[source] = slots[destination]!;
  next[destination] = slots[source]!;
  return next;
}
