/** A plain-text post-completion display name, not identity or authorization.
 * Preserves the existing Daily Nine 1–32 JS-code-unit boundary/trim behavior;
 * Custom completion may reuse it only after independent attempt-cookie authorization.
 */
export const COMPLETION_DISPLAY_NAME_MAX_LENGTH = 32;

export type ParsedCompletionDisplayName =
  | Readonly<{ ok: true; displayName: string }>
  | Readonly<{ ok: false }>;

export function parseCompletionDisplayName(value: unknown): ParsedCompletionDisplayName {
  if (typeof value !== 'string') return { ok: false };
  const displayName = value.trim();
  if (displayName.length < 1 || displayName.length > COMPLETION_DISPLAY_NAME_MAX_LENGTH
    || /[\x00-\x1f\x7f-\x9f]/.test(displayName)) return { ok: false };
  return { ok: true, displayName };
}
