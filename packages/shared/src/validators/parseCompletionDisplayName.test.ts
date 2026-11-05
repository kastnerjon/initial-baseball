import { describe, expect, it } from 'vitest';
import {
  COMPLETION_DISPLAY_NAME_MAX_LENGTH, parseCompletionDisplayName,
} from './parseCompletionDisplayName.js';

describe('post-completion display name policy shared with Daily', () => {
  it('trims edges and retains plain text, punctuation and international names', () => {
    expect(parseCompletionDisplayName('  Ada  ')).toEqual({ ok: true, displayName: 'Ada' });
    expect(parseCompletionDisplayName('Zoë & Avi')).toEqual({ ok: true, displayName: 'Zoë & Avi' });
    expect(parseCompletionDisplayName("O'Neill")).toEqual({ ok: true, displayName: "O'Neill" });
  });

  it('preserves inclusive existing Daily UTF-16 length limits and emoji behavior', () => {
    expect(parseCompletionDisplayName('x'.repeat(COMPLETION_DISPLAY_NAME_MAX_LENGTH)))
      .toEqual({ ok: true, displayName: 'x'.repeat(32) });
    expect(parseCompletionDisplayName('x'.repeat(33))).toEqual({ ok: false });
    expect(parseCompletionDisplayName('⚾'.repeat(32)))
      .toEqual({ ok: true, displayName: '⚾'.repeat(32) });
    expect(parseCompletionDisplayName('😀'.repeat(16)))
      .toEqual({ ok: true, displayName: '😀'.repeat(16) });
    expect(parseCompletionDisplayName('😀'.repeat(17))).toEqual({ ok: false });
  });

  it('rejects empty, invalid type and control characters without access to a score', () => {
    for (const value of [null, undefined, 1, {}, ['Alice'], '', ' \t\n ', 'A\nB',
      'A\u0000B', 'A\u007fB', 'A\u009fB', 'A\tB']) {
      expect(parseCompletionDisplayName(value)).toEqual({ ok: false });
    }
  });

  it('does not interpret submission identity, HTML, or nickname as authorization', () => {
    expect(parseCompletionDisplayName('<script>')).toEqual({
      ok: true, displayName: '<script>',
    });
    // Rendering remains escaped at the presentation layer; this parser only
    // defines the historical Daily input boundary, not eligibility or safety.
  });
});
