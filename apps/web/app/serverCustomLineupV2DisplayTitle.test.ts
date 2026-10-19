import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));
import { readCustomLineupV2DisplayTitle } from './serverCustomLineupV2DisplayTitle';

const ID = 'custom-lineup-v2-123e4567-e89b-42d3-a456-426614174000';
function clientFixture(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn(async () => ({ data, error }));
  const abortSignal = vi.fn((_signal: AbortSignal) => ({ maybeSingle }));
  const eq = vi.fn(() => ({ abortSignal }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, eq, abortSignal };
}

describe('unlisted Custom v2 title projection', () => {
  it('requests only title, scoped by canonical puzzle ID; never loads answers', async () => {
    const fixture = clientFixture({ display_title: '  Mets   Legends  ' });
    expect(await readCustomLineupV2DisplayTitle(ID, () => fixture.client))
      .toBe('Mets Legends');
    expect(fixture.from).toHaveBeenCalledWith('custom_nine_issued_challenges');
    expect(fixture.select).toHaveBeenCalledWith('display_title');
    expect(fixture.eq).toHaveBeenCalledWith('puzzle_id', ID);
    expect(JSON.stringify(fixture.select.mock.calls)).not.toContain('canonical_player_ids');
    expect(JSON.stringify(fixture.select.mock.calls)).not.toContain('clue_snapshot');
  });

  it('leaves pre-title legacy v2 challenges and malformed display names generic', async () => {
    for (const record of [null, { display_title: null },
      { display_title: '<script>alert(1)</script>' }, { display_title: ' ' },
      { display_title: '\uFE0F\uFE0F\uFE0F' }, { display_title: 77 }]) {
      const fixture = clientFixture(record);
      expect(await readCustomLineupV2DisplayTitle(ID, () => fixture.client)).toBeNull();
    }
  });

  it('cancels a pending metadata query and opens the game with generic title on timeout', async () => {
    vi.useFakeTimers();
    try {
      const maybeSingle = vi.fn(() => new Promise<never>(() => {}));
      const abortSignal = vi.fn((_signal: AbortSignal) => ({ maybeSingle }));
      const eq = vi.fn(() => ({ abortSignal }));
      const select = vi.fn(() => ({ eq }));
      const from = vi.fn(() => ({ select }));
      const pending = readCustomLineupV2DisplayTitle(ID,
        () => ({ from } as unknown as SupabaseClient));
      await vi.advanceTimersByTimeAsync(1500);
      expect(await pending).toBeNull();
      expect(abortSignal).toHaveBeenCalledTimes(1);
      const signal = abortSignal.mock.calls[0]?.[0] as AbortSignal | undefined;
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails open to generic title on transport/config errors but never on invalid puzzle ID', async () => {
    const factory = vi.fn(() => { throw new Error('Database offline'); });
    expect(await readCustomLineupV2DisplayTitle(ID, factory)).toBeNull();
    expect(factory).toHaveBeenCalledOnce();
    factory.mockClear();
    expect(await readCustomLineupV2DisplayTitle('custom-nine-v1-bad', factory)).toBeNull();
    expect(factory).not.toHaveBeenCalled();
    const fixture = clientFixture(null, { message: 'offline' });
    expect(await readCustomLineupV2DisplayTitle(ID, () => fixture.client)).toBeNull();
  });
});
