import type { GameSettings } from '@initial-baseball/shared';

export type ResolvedHitResult = 'home_run' | 'triple' | 'double' | 'single' | 'walk';

export function getHitResultForRevealCount(revealedHintCount: number, settings: GameSettings): ResolvedHitResult {
  if (revealedHintCount === 0) return 'home_run';

  const slot = settings.hintConfig.find((hint) => hint.slot === revealedHintCount);
  if (!slot) {
    throw new Error(`No hint slot configured for reveal count ${revealedHintCount}`);
  }

  return slot.result;
}
