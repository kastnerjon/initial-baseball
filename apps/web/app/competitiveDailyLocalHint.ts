import type { DailyBootstrap } from './dailyRuntimeContracts';

const key = (id: string) => 'initial-baseball:official-competitive-hint:v1:' + id;
type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type CompetitiveWrongGuess = { playerId: string; displayName: string };

function readSaved(storage: HintStorage, puzzleId: string): Record<string, unknown> | null {
  const raw = storage.getItem(key(puzzleId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function validWrongGuesses(value: unknown): value is CompetitiveWrongGuess[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 2 &&
    value.every(guess => guess !== null && typeof guess === 'object' && !Array.isArray(guess) &&
      typeof guess.playerId === 'string' && guess.playerId.length >= 1 && guess.playerId.length <= 100 &&
      typeof guess.displayName === 'string' && guess.displayName.trim() === guess.displayName &&
      guess.displayName.length >= 1 && guess.displayName.length <= 180);
}

export function saveCompetitiveHint(storage: HintStorage, puzzleId: string, anchor: string, depth: number) {
  const saved = readSaved(storage, puzzleId);
  const wrongGuesses = saved?.anchor === anchor && validWrongGuesses(saved.wrongGuesses)
    ? saved.wrongGuesses : undefined;
  storage.setItem(key(puzzleId), JSON.stringify({ anchor, depth, ...(wrongGuesses ? { wrongGuesses } : {}) }));
}

/** Optional UI-only history. Signed progression, not local storage, owns strikes and scoring. */
export function saveCompetitiveWrongGuesses(
  storage: HintStorage, puzzleId: string, anchor: string, depth: number, wrongGuesses: CompetitiveWrongGuess[],
): void {
  if (typeof anchor !== 'string' || anchor.length < 1 || anchor.length > 4096 ||
      !Number.isInteger(depth) || depth < 0 || depth > 4 || !validWrongGuesses(wrongGuesses)) {
    throw new Error('Invalid competitive wrong-guess display cache.');
  }
  storage.setItem(key(puzzleId), JSON.stringify({ anchor, depth, wrongGuesses }));
}

export function restoreCompetitiveWrongGuesses(
  storage: HintStorage, puzzleId: string, anchor: string, strikeCount: number,
): CompetitiveWrongGuess[] {
  if (!Number.isInteger(strikeCount) || strikeCount < 1 || strikeCount > 2) return [];
  const saved = readSaved(storage, puzzleId);
  if (saved?.anchor !== anchor || !validWrongGuesses(saved.wrongGuesses) ||
      saved.wrongGuesses.length !== strikeCount) return [];
  return saved.wrongGuesses.map(guess => ({ ...guess }));
}

/** Reuse only a checkpoint reissued in the current server-authorized bundle. */
export function restoreCompetitiveHint(storage: HintStorage, bootstrap: DailyBootstrap): DailyBootstrap {
  const saved = readSaved(storage, bootstrap.puzzle.id);
  if (saved?.anchor !== bootstrap.progressionToken) return bootstrap;
  const checkpoint = bootstrap.hintBundle.checkpoints.find(item => item.revealedCount === saved.depth);
  if (!checkpoint) return bootstrap;
  return { ...bootstrap, progressionToken: checkpoint.progressionToken,
    hintBundle: { ...bootstrap.hintBundle, revealedCount: checkpoint.revealedCount } };
}

/** Browser caches are optional. Storage denial must never deny signed gameplay. */
export function restoreCompetitiveHintSafely(
  bootstrap: DailyBootstrap, getStorage: () => HintStorage = () => globalThis.localStorage,
): DailyBootstrap {
  try { return restoreCompetitiveHint(getStorage(), bootstrap); } catch { return bootstrap; }
}

export function saveCompetitiveHintSafely(
  puzzleId: string, anchor: string, depth: number,
  getStorage: () => HintStorage = () => globalThis.localStorage,
): void {
  try { saveCompetitiveHint(getStorage(), puzzleId, anchor, depth); } catch { /* Optional cache. */ }
}

export function restoreCompetitiveWrongGuessesSafely(
  puzzleId: string, anchor: string, strikeCount: number,
  getStorage: () => HintStorage = () => globalThis.localStorage,
): CompetitiveWrongGuess[] {
  try { return restoreCompetitiveWrongGuesses(getStorage(), puzzleId, anchor, strikeCount); }
  catch { return []; }
}

export function saveCompetitiveWrongGuessesSafely(
  puzzleId: string, anchor: string, depth: number, wrongGuesses: CompetitiveWrongGuess[],
  getStorage: () => HintStorage = () => globalThis.localStorage,
): void {
  try { saveCompetitiveWrongGuesses(getStorage(), puzzleId, anchor, depth, wrongGuesses); }
  catch { /* Optional cache. */ }
}
