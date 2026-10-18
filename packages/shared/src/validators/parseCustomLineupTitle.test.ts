import { describe, expect, it } from 'vitest';
import {
  CUSTOM_LINEUP_TITLE_MAX_LENGTH,
  CUSTOM_LINEUP_TITLE_MIN_LENGTH,
  parseCustomLineupTitle,
} from './parseCustomLineupTitle.js';

describe('Custom Lineup name contract (private and public)', () => {
  it('requires a human-entered name and normalizes horizontal spacing and Unicode', () => {
    expect(parseCustomLineupTitle('  1998   Yankees Legends  ')).toEqual({
      ok: true, title: '1998 Yankees Legends',
    });
    expect(parseCustomLineupTitle('Cafe\u0301 Crew')).toEqual({ ok: true, title: 'Café Crew' });
    expect(parseCustomLineupTitle('  The\u00a0Big   Red  Machine ')).toEqual({
      ok: true, title: 'The Big Red Machine',
    });
  });

  it('enforces inclusive min/max Unicode code point limits after normalization', () => {
    for (const n of [CUSTOM_LINEUP_TITLE_MIN_LENGTH, CUSTOM_LINEUP_TITLE_MAX_LENGTH]) {
      expect(parseCustomLineupTitle('x'.repeat(n))).toEqual({ ok: true, title: 'x'.repeat(n) });
    }
    expect(parseCustomLineupTitle('x'.repeat(CUSTOM_LINEUP_TITLE_MIN_LENGTH - 1))).toEqual({ ok: false });
    expect(parseCustomLineupTitle('x'.repeat(CUSTOM_LINEUP_TITLE_MAX_LENGTH + 1))).toEqual({ ok: false });
    expect(parseCustomLineupTitle('⚾⚾⚾')).toEqual({ ok: true, title: '⚾⚾⚾' });
  });

  it('rejects nontext, controls, injected markup and invisible format characters', () => {
    for (const input of [null, undefined, {}, ['title'], 22, true, '', '   ', '<img src=x>',
      'No <script>', 'a\nb', 'a\rb', 'a\tb', 'No\u202eRace', 'A\u200bB', 'a\u0000b',
      '\ud800a title', '\uFE0F\uFE0F\uFE0F', '\u0301\u0301\u0301', '!!!']) {
      expect(parseCustomLineupTitle(input)).toEqual({ ok: false });
    }
  });

  it('does not strip useful punctuation or confuse private title validation with publishing', () => {
    expect(parseCustomLineupTitle("The '69 Mets!")).toEqual({ ok: true, title: "The '69 Mets!" });
    expect(parseCustomLineupTitle('Teams & Dreams')).toEqual({ ok: true, title: 'Teams & Dreams' });
  });
});
