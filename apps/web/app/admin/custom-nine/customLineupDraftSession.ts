import type { CustomLineupStrikeLimit } from '@initial-baseball/daily';
import type { CustomLineupSlots } from './customNineCreatorSelection';

export const CUSTOM_LINEUP_DRAFT_KEY = 'initial-baseball-custom-creator-draft-v1';
export type CustomLineupDraft = Readonly<{ title: string; slots: CustomLineupSlots; strikeLimit: CustomLineupStrikeLimit }>;

/** Browser session-only draft. Never persists hints, owner codes, answers for unselected players, or credentials. */
export function parseCustomLineupDraft(value: unknown): CustomLineupDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (Object.keys(draft).some(key => key !== 'title' && key !== 'slots' && key !== 'strikeLimit')
    || !Object.hasOwn(draft, 'title') || !Object.hasOwn(draft, 'slots')
    || typeof draft.title !== 'string'
    || draft.title.length > 100 || !Array.isArray(draft.slots)
    || draft.slots.length < 1 || draft.slots.length > 10) return null;
  // Missing is a pre-setting draft; explicit NULL is invalid.
  const strikeLimit = Object.hasOwn(draft, 'strikeLimit') ? draft.strikeLimit : 3;
  if (strikeLimit !== 1 && strikeLimit !== 2 && strikeLimit !== 3) return null;
  const slots: CustomLineupSlots[number][] = [];
  const ids = new Set<string>();
  for (const entry of draft.slots) {
    if (entry === null) {
      slots.push(null);
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
    slots.push({
      playerId: player.playerId, displayName: player.displayName, label: player.label,
    });
  }
  return { title: draft.title, slots, strikeLimit };
}
