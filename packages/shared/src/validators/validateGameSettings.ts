import type { GameSettings, HintType } from '../types/gameSettings.js';

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const ALPHA_HINT_TYPES: ReadonlySet<HintType> = new Set(['main_decade', 'teams', 'position', 'stats']);

export function validateGameSettings(settings: GameSettings): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(settings.innings) || settings.innings < 1 || settings.innings > 9) {
    errors.push('Innings must be an integer from 1 to 9.');
  }

  if (!Number.isInteger(settings.strikesPerAtBat) || settings.strikesPerAtBat < 1 || settings.strikesPerAtBat > 5) {
    errors.push('Strikes per at-bat must be an integer from 1 to 5.');
  }

  if (!Number.isInteger(settings.outsPerHalfInning) || settings.outsPerHalfInning < 1 || settings.outsPerHalfInning > 5) {
    errors.push('Outs per half-inning must be an integer from 1 to 5.');
  }

  if (settings.hintConfig.length !== 4) {
    errors.push('Hint config must contain exactly 4 slots.');
  }

  const sorted = [...settings.hintConfig].sort((a, b) => a.slot - b.slot);
  const expectedResults = ['triple', 'double', 'single', 'sac'];
  const seenHints = new Set<HintType>();

  sorted.forEach((slot, index) => {
    if (slot.slot !== index + 1) errors.push(`Hint slot ${index + 1} is missing or out of order.`);
    if (slot.result !== expectedResults[index]) errors.push(`Slot ${slot.slot} must map to ${expectedResults[index]}.`);
    if (!ALPHA_HINT_TYPES.has(slot.hintType)) errors.push(`Hint type ${slot.hintType} is not enabled for alpha.`);
    if (seenHints.has(slot.hintType)) errors.push(`Duplicate hint type ${slot.hintType}.`);
    seenHints.add(slot.hintType);
  });

  if (seenHints.has('stats')) {
    if (settings.statsHintConfig.hitter.length < 1) errors.push('Stats hint requires at least one hitter stat.');
    if (settings.statsHintConfig.pitcher.length < 1) errors.push('Stats hint requires at least one pitcher stat.');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
