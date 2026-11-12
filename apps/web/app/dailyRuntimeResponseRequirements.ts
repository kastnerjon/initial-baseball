import type { CanonicalRevealViewModel } from './canonicalRevealViewModel';
import type { DailyHintBundle } from './dailyRuntimeContracts';

/** Require the signed server response to have an active clue bundle. */
export function requireHintBundle(bundle: DailyHintBundle | null): DailyHintBundle {
  if (bundle === null) throw new Error('An active Daily result did not include an authorized hint bundle.');
  return bundle;
}

/** Require terminal responses to include a public canonical reveal. */
export function requireReveal(reveal: CanonicalRevealViewModel | null): CanonicalRevealViewModel {
  if (reveal === null) throw new Error('A terminal Daily result did not include canonical reveal data.');
  return reveal;
}
