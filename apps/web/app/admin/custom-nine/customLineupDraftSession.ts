import type { CustomLineupSlots } from './customNineCreatorSelection';

export const CUSTOM_LINEUP_DRAFT_KEY = 'initial-baseball-custom-creator-draft-v1';
export type CustomLineupDraft = Readonly<{ title: string; slots: CustomLineupSlots }>;

/** Browser session-only draft. Never persists hints, owner codes, answers for unselected players, or credentials. */
export function parseCustomLineupDraft(value: unknown): CustomLineupDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (Object.keys(draft).length !== 2 || typeof draft.title !== 'string'
    || draft.title.length > 100 || !Array.isArray(draft.slots)
    || draft.slots.length < 1 || draft.slots.length > 10) return null;
  const slots: CustomLineupSlots = [];
  const ids = new Set<string>();
  for (const entry of draft.slots) {
    if (entry === null) {
      (slots as (null | CustomLineupSlots[number])[]).push(null);
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const player = entry as Record<string, unknown>;
    if (Object.keys(player).length !== 3
      || typeof player.playerId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(player.playerId)
      || typeof player.displayName !== 'string' || player.displayName.length > 150
      || !player.displayName.trim()
      || typeof player.label !== 'string' || player.label.length > 200 || !player.label.trim()
      || ids.has(player.playerId)) return null;
    ids.add(player.playerId);
    (slots as (null | CustomLineupSlots[number])[]).push({
      playerId: player.playerId, displayName: player.displayName, label: player.label,
    });
  }
  return { title: draft.title, slots };
}
