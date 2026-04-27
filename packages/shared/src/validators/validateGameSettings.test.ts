import { expect, it } from 'vitest';
import { DEFAULT_ALPHA_SETTINGS } from '../types/gameSettings.js';
import { validateGameSettings } from './validateGameSettings.js';

it('accepts default alpha settings', () => {
  expect(validateGameSettings(DEFAULT_ALPHA_SETTINGS)).toEqual({ ok: true });
});

it('requires at least one hitter and pitcher stat when stats hint is included', () => {
  const result = validateGameSettings({
    ...DEFAULT_ALPHA_SETTINGS,
    statsHintConfig: { hitter: [], pitcher: [] },
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors).toContain('Stats hint requires at least one hitter stat.');
    expect(result.errors).toContain('Stats hint requires at least one pitcher stat.');
  }
});
