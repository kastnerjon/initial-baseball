import { describe, expect, it } from 'vitest';
import { parseCustomLineupDraft } from './customLineupDraftSession';

const player = { playerId: 'ibp_00000000000000000001', displayName: 'Babe Ruth', label: 'Babe Ruth · 1914–1935' };

describe('session-only Custom creator draft decoding', () => {
  it('round trips a partial, ordered 1–10-player draft without server issuance', () => {
    const value = { title: '  All-time Yankees ', slots: [null, player, null] };
    expect(parseCustomLineupDraft(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });
  it('rejects malformed, oversized, duplicated and untrusted local data', () => {
    for (const value of [
      null, {}, [], { title: 'x', slots: [] },
      { title: 'x'.repeat(101), slots: [player] },
      { title: 'abc', slots: Array(11).fill(null) },
      { title: 'abc', slots: [player, player] },
      { title: 'abc', slots: [{ ...player, playerId: '../spoof' }] },
      { title: 'abc', slots: [{ ...player, label: '' }] },
      { title: 'abc', slots: [player], ownerCapability: 'secret' },
    ]) expect(parseCustomLineupDraft(value)).toBeNull();
  });
});
