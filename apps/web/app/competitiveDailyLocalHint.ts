import type { DailyBootstrap } from './dailyRuntimeContracts';

const key = (id: string) => 'initial-baseball:official-competitive-hint:v1:' + id;
type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function saveCompetitiveHint(storage: HintStorage, puzzleId: string, anchor: string, depth: number) {
  storage.setItem(key(puzzleId), JSON.stringify({ anchor, depth }));
}

/** Reuse only a checkpoint reissued in the current server-authorized bundle. */
export function restoreCompetitiveHint(storage: HintStorage, bootstrap: DailyBootstrap): DailyBootstrap {
  const raw = storage.getItem(key(bootstrap.puzzle.id));
  if (!raw) return bootstrap;
  let saved;
  try { saved = JSON.parse(raw); } catch { return bootstrap; }
  if (saved?.anchor !== bootstrap.progressionToken) return bootstrap;
  const checkpoint = bootstrap.hintBundle.checkpoints.find(item => item.revealedCount === saved.depth);
  if (!checkpoint) return bootstrap;
  return { ...bootstrap, progressionToken: checkpoint.progressionToken,
    hintBundle: { ...bootstrap.hintBundle, revealedCount: checkpoint.revealedCount } };
}

/** Browser hint caches are optional. A storage denial must never deny signed gameplay. */
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
