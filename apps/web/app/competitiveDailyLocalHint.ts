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
