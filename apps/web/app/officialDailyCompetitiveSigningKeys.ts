import 'server-only';

const MINIMUM_SECRET_LENGTH = 32;
const MAX_LEGACY_KEYS = 8;

/**
 * Only the active key signs new cookies and progression proofs. Explicit legacy
 * keys verify existing attempts; removing one revokes all material it signed.
 * Keep retired keys only while their existing players must remain recoverable.
 */
export function readOfficialDailyCompetitiveSigningKeys(
  environment: Record<string, string | undefined> = process.env,
): { active: string; legacy: readonly string[] } {
  const active = environment.OFFICIAL_DAILY_COMPETITIVE_SECRET?.trim();
  if (!active || active.length < MINIMUM_SECRET_LENGTH) {
    throw new Error('Official Daily competitive signing unavailable.');
  }

  const source = environment.OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON;
  if (source === undefined || source === '') return { active, legacy: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(source) as unknown; }
  catch { throw new Error('Official Daily competitive signing configuration invalid.'); }
  if (!Array.isArray(parsed) || parsed.length > MAX_LEGACY_KEYS ||
      parsed.some(key => typeof key !== 'string' || key.length < MINIMUM_SECRET_LENGTH ||
        key.trim() !== key) ||
      new Set([active, ...parsed]).size !== parsed.length + 1) {
    throw new Error('Official Daily competitive signing configuration invalid.');
  }
  return { active, legacy: parsed as string[] };
}
