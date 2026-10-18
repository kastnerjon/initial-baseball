/**
 * The user-supplied public/private Custom Lineup display name.
 * This is a portable input contract, not a publish/moderation permission.
 * Rendering must still escape it and public listing requires separate approval.
 */
export const CUSTOM_LINEUP_TITLE_MIN_LENGTH = 3;
export const CUSTOM_LINEUP_TITLE_MAX_LENGTH = 60;

export type ParsedCustomLineupTitle =
  | { ok: true; title: string }
  | { ok: false };

export function parseCustomLineupTitle(value: unknown): ParsedCustomLineupTitle {
  if (typeof value !== 'string') return { ok: false };
  // Reject line breaks, controls (including bidi/zero-width format controls),
  // and HTML markup delimiters instead of attempting unsafe HTML sanitization.
  if (/[<>\p{C}\p{Zl}\p{Zp}]/u.test(value)) return { ok: false };
  const title = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  // Variation selectors and combining marks alone render as a blank title.
  // Require a visible letter, number, pictograph or regional indicator.
  if (!/[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(title)) {
    return { ok: false };
  }
  const length = Array.from(title).length;
  if (length < CUSTOM_LINEUP_TITLE_MIN_LENGTH || length > CUSTOM_LINEUP_TITLE_MAX_LENGTH) {
    return { ok: false };
  }
  return { ok: true, title };
}
