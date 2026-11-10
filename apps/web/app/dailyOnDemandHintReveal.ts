import type { DailyHintConfig, DailyRevealCount } from '@initial-baseball/shared';
import type { DailyHintBundle } from './dailyRuntimeContracts';
import type { LocalDailyHintReveal } from './dailyHintBundle';

type AppliedDailyHint = {
  hintBundle: DailyHintBundle;
  reveal: LocalDailyHintReveal;
};

function incompatible(): never {
  throw new Error('Incompatible on-demand Daily hint response.');
}

/**
 * Browser-only reconciliation for a single server-authorized hint.
 * Never derive a reveal from a locally preloaded clue/checkpoint. This is a
 * response-shape and state-continuity check, not verification of a signed token;
 * the next server request remains the authority for its puzzle and progression.
 */
export function applyOnDemandDailyHintReveal(
  bundle: DailyHintBundle,
  hintConfig: DailyHintConfig,
  previousProgressionToken: string,
  response: unknown,
): AppliedDailyHint {
  if (!Array.isArray(hintConfig) || hintConfig.length !== 4
      || !Number.isSafeInteger(bundle.pitchNumber) || bundle.pitchNumber < 1
      || !Number.isInteger(bundle.revealedCount)
      || bundle.revealedCount < 0 || bundle.revealedCount >= 4
      || !Array.isArray(bundle.hints) || bundle.hints.length !== bundle.revealedCount
      || !Array.isArray(bundle.checkpoints) || bundle.checkpoints.length !== 0
      || typeof previousProgressionToken !== 'string' || previousProgressionToken.length === 0) {
    incompatible();
  }
  for (let index = 0; index < hintConfig.length; index += 1) {
    const slot = hintConfig[index];
    if (!slot || slot.slot !== index + 1) incompatible();
    if (index < bundle.revealedCount) {
      const existing = bundle.hints[index];
      if (!existing || existing.slot !== slot.slot
          || existing.hintType !== slot.hintType
          || existing.hintLabel !== slot.displayLabel
          || typeof existing.hintValue !== 'string') incompatible();
    }
  }

  if (response === null || typeof response !== 'object' || Array.isArray(response)) incompatible();
  const value = response as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'hint,progressionToken'
      || typeof value.progressionToken !== 'string'
      || value.progressionToken.length === 0 || value.progressionToken.length > 4096
      || value.progressionToken === previousProgressionToken) incompatible();

  const hint = value.hint;
  if (hint === null || typeof hint !== 'object' || Array.isArray(hint)) incompatible();
  const item = hint as Record<string, unknown>;
  const expected = hintConfig[bundle.revealedCount];
  if (!expected || Object.keys(item).sort().join(',') !== 'hintLabel,hintType,hintValue'
      || item.hintType !== expected.hintType
      || item.hintLabel !== expected.displayLabel
      || typeof item.hintValue !== 'string' || item.hintValue.length === 0) incompatible();

  const revealedCount = (bundle.revealedCount + 1) as DailyRevealCount;
  const authorizedHint = {
    hintType: expected.hintType,
    hintLabel: expected.displayLabel,
    hintValue: item.hintValue,
  };
  return {
    reveal: {
      hint: authorizedHint,
      revealedCount,
      progressionToken: value.progressionToken,
    },
    hintBundle: {
      pitchNumber: bundle.pitchNumber,
      revealedCount,
      hints: [...bundle.hints, { slot: expected.slot, ...authorizedHint }],
      checkpoints: [],
    },
  };
}
