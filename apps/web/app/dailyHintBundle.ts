import type { DailyRevealCount } from '@initial-baseball/shared';
import type { DailyAuthorizedHint, DailyHintBundle } from './dailyRuntimeContracts';

export type LocalDailyHintReveal = {
  hint: Omit<DailyAuthorizedHint, 'slot'>;
  revealedCount: DailyRevealCount;
  progressionToken: string;
};

export function revealNextHintFromBundle(
  bundle: DailyHintBundle,
  currentRevealCount: DailyRevealCount,
): LocalDailyHintReveal {
  const nextRevealCount = incrementRevealCount(currentRevealCount);
  const hint = bundle.hints.find(candidate => candidate.slot === nextRevealCount);
  const checkpoint = bundle.checkpoints.find(candidate => candidate.revealedCount === nextRevealCount);

  if (hint === undefined || checkpoint === undefined) {
    throw new Error(`The active at-bat is missing authorized hint checkpoint ${nextRevealCount}.`);
  }

  return {
    hint: {
      hintType: hint.hintType,
      hintLabel: hint.hintLabel,
      hintValue: hint.hintValue,
    },
    revealedCount: nextRevealCount,
    progressionToken: checkpoint.progressionToken,
  };
}

function incrementRevealCount(value: DailyRevealCount): Exclude<DailyRevealCount, 0> {
  switch (value) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case 4:
      throw new Error('All Daily hints are already revealed.');
  }
}
