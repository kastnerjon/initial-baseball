import type { CanonicalRuntimeAccessor } from '@initial-baseball/baseball-data/runtime';
import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createServerOfficialDailyEditionRuntime } from './serverOfficialDailyEditionRuntime';

const DATE = '2026-11-06';
const FIRST_ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const SECOND_ID = 'daily-ed-v1-6077ee21-9370-4cf3-aa21-74c50b485591';
const SECRET = 'private-official-daily-runtime-test-secret-01234567';
const TOKENS = createDailyProgressionTokenCodec(SECRET);
const NOW = new Date('2026-11-06T08:00:00.000Z');
const ANSWER_ID = 'ibp_ab000000000000000000';
const client = {} as SupabaseClient;
const canonicalRuntime = { getReveal: vi.fn(() => ({})) } as unknown as CanonicalRuntimeAccessor;

function puzzle(id: string): DailyPuzzle {
  return {
    id, puzzleDate: DATE, puzzleNumber: 194, status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      player: { playerId: ANSWER_ID, fullName: 'Hidden Player',
        displayName: 'Hidden Player', initials: 'HP', kind: 'hitter' as const,
        primaryPosition: 'CF' },
      hints: { main_decade: 'PRIVATE_HINT_MARKER', teams: 'NYM',
        position: 'CF', stats: '3 HR' },
    })),
  };
}

function dependencies(readReleasedPuzzle: (client: SupabaseClient, id: string, now: Date) => Promise<DailyPuzzle | null>) {
  return {
    environment: { OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED: 'true' },
    createClient: vi.fn(() => client),
    canonicalRuntime: vi.fn(() => canonicalRuntime),
    progressionTokens: vi.fn(() => TOKENS),
    now: vi.fn(() => NOW),
    readReleasedPuzzle: vi.fn(readReleasedPuzzle),
  };
}

describe('private official Daily edition runtime composition', () => {
  it('fails closed without exact flag or canonical occurrence before constructing services', () => {
    const d = dependencies(async () => puzzle(FIRST_ID));
    for (const environment of [{}, { OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED: 'false' }]) {
      expect(() => createServerOfficialDailyEditionRuntime(FIRST_ID, { ...d, environment }))
        .toThrow('Official Daily edition unavailable');
    }
    for (const id of ['daily-ed-v1-not-a-uuid', 'daily-2026-11-06', 'daily-ed-v1-907F33DB-c38f-43c3-8e6b-a3aaf19bbd08']) {
      expect(() => createServerOfficialDailyEditionRuntime(id, d))
        .toThrow('Official Daily edition unavailable');
    }
    expect(d.createClient).not.toHaveBeenCalled();
    expect(d.canonicalRuntime).not.toHaveBeenCalled();
    expect(d.readReleasedPuzzle).not.toHaveBeenCalled();
  });

  it('loads only released exact-ID content and serializes no future hints', async () => {
    const d = dependencies(async (_client, id) => puzzle(id));
    const runtime = createServerOfficialDailyEditionRuntime(FIRST_ID, d);
    const boot = await runtime.getBootstrap(DATE);
    expect(boot.puzzle.id).toBe(FIRST_ID);
    expect(boot.puzzle.pitches).toHaveLength(9);
    expect(boot.hintBundle).toMatchObject({ revealedCount: 0, hints: [], checkpoints: [] });
    expect(JSON.stringify(boot)).not.toContain('PRIVATE_HINT_MARKER');
    expect(JSON.stringify(boot)).not.toContain('Hidden Player');
    expect(JSON.stringify(boot)).not.toContain(ANSWER_ID);
    expect(d.readReleasedPuzzle).toHaveBeenCalledWith(client, FIRST_ID, NOW);
    expect((await runtime.revealHint(boot.progressionToken)).hint.hintValue)
      .toBe('PRIVATE_HINT_MARKER');
  });

  it('fails closed for a missing or future publication and never invents a puzzle', async () => {
    const d = dependencies(async () => null);
    const runtime = createServerOfficialDailyEditionRuntime(FIRST_ID, d);
    await expect(runtime.getBootstrap(DATE)).rejects.toThrow('Official Daily edition unavailable');
    expect(d.readReleasedPuzzle).toHaveBeenCalledWith(client, FIRST_ID, NOW);
  });

  it('refuses sibling-edition tokens before issuing an answer-bearing read', async () => {
    const first = dependencies(async (_client, id) => puzzle(id));
    const second = dependencies(async (_client, id) => puzzle(id));
    const token = (await createServerOfficialDailyEditionRuntime(FIRST_ID, first)
      .getBootstrap(DATE)).progressionToken;
    const secondRuntime = createServerOfficialDailyEditionRuntime(SECOND_ID, second);
    await expect(secondRuntime.getHintBundle(token)).rejects.toThrow();
    await expect(secondRuntime.revealHint(token)).rejects.toThrow();
    expect(second.readReleasedPuzzle).not.toHaveBeenCalled();
  });

  it('does not trust the reader if its return identity differs from the requested ID', async () => {
    const d = dependencies(async () => puzzle(SECOND_ID));
    const runtime = createServerOfficialDailyEditionRuntime(FIRST_ID, d);
    await expect(runtime.getBootstrap(DATE)).rejects.toThrow('Official Daily edition unavailable');
  });
});
