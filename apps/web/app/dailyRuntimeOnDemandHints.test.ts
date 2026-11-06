import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createDailyRuntimeService, createExactIdDailyRuntimeService } from './dailyRuntimeService';

vi.mock('./canonicalRevealViewModel', () => ({
  createCanonicalRevealViewModel: () => ({ playerId: 'ibp_ab000000000000000000' }),
}));

const answerId = 'ibp_ab000000000000000000';
const firstHint = 'PRIVATE_FIRST_HINT_MARKER';
const nextHint = 'PRIVATE_NEXT_BATTER_HINT_MARKER';
const date = '2026-11-06';
const tokens = createDailyProgressionTokenCodec('on-demand-daily-hint-test-secret-0123456789');

/** Return one nine-pitch test puzzle with distinct first and future hint markers. */
function puzzle(): DailyPuzzle {
  return {
    id: 'daily-' + date,
    puzzleDate: date,
    puzzleNumber: 194,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: Array.from({ length: 9 }, (_, index) => ({
      pitchNumber: index + 1,
      player: {
        playerId: answerId,
        fullName: 'Protected Player',
        displayName: 'Protected Player',
        initials: 'PP',
        kind: 'hitter' as const,
        primaryPosition: 'CF',
      },
      hints: {
        main_decade: index === 0 ? firstHint : nextHint,
        teams: 'NYM',
        position: 'CF',
        stats: '3 HR',
      },
    })),
  };
}

describe('on-demand Daily hint transport for future official editions', () => {
  it('does not preload hidden hints or future signed checkpoints', async () => {
    const runtime = createDailyRuntimeService({
      createPuzzle: () => puzzle(),
      progressionTokens: tokens,
      resolveLegacyPlayerId: playerId => playerId,
      getCanonicalReveal: () => ({} as never),
      hintTransport: 'on-demand',
    });
    const boot = await runtime.getBootstrap(date);
    expect(boot.hintBundle.hints).toEqual([]);
    expect(boot.hintBundle.checkpoints).toEqual([]);
    expect(JSON.stringify(boot)).not.toContain(firstHint);
    expect(JSON.stringify(boot)).not.toContain(nextHint);

    const reveal = await runtime.revealHint(boot.progressionToken);
    expect(reveal.hint.hintValue).toBe(firstHint);
    expect(tokens.verify(reveal.progressionToken).revealCount).toBe(1);
    const resume = await runtime.getHintBundle(reveal.progressionToken);
    expect(resume.hintBundle.hints.map(hint => hint.hintValue)).toEqual([firstHint]);
    expect(resume.hintBundle.checkpoints).toEqual([]);
    expect(JSON.stringify(resume)).not.toContain(nextHint);

    const wrong = await runtime.resolveAtBat({
      progressionToken: reveal.progressionToken,
      submittedPlayerId: 'ibp_cd000000000000000000',
    });
    expect(wrong.hintBundle?.hints.map(hint => hint.hintValue)).toEqual([firstHint]);
    expect(wrong.hintBundle?.checkpoints).toEqual([]);
    expect(JSON.stringify(wrong)).not.toContain(nextHint);

    const afterWrong = await runtime.getHintBundle(wrong.progressionToken);
    expect(afterWrong.hintBundle.hints.map(hint => hint.hintValue)).toEqual([firstHint]);
    expect(afterWrong.hintBundle.checkpoints).toEqual([]);
    expect(JSON.stringify(afterWrong)).not.toContain(nextHint);

    const next = await runtime.resolveAtBat({
      progressionToken: wrong.progressionToken,
      submittedPlayerId: answerId,
    });
    expect(next.result.kind).toBe('correct');
    expect(next.hintBundle?.pitchNumber).toBe(2);
    expect(next.hintBundle?.hints).toEqual([]);
    expect(next.hintBundle?.checkpoints).toEqual([]);
    expect(JSON.stringify(next)).not.toContain(nextHint);
  });
});

describe('exact-ID official runtime', () => {
  const first = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
  const second = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd09';

  it('rejects sibling and invalid tokens before reading an identical roster', async () => {
    const readEligiblePuzzle = vi.fn(async (id: string) => ({ ...puzzle(), id }));
    const edition = (puzzleId: string) => createExactIdDailyRuntimeService({
      puzzleId, progressionTokens: tokens, readEligiblePuzzle,
    });
    const boot = await edition(first).getBootstrap(date);
    expect(readEligiblePuzzle).toHaveBeenCalledWith(first);
    expect(boot.hintBundle.hints).toEqual([]);
    expect(boot.hintBundle.checkpoints).toEqual([]);
    expect((await edition(first).revealHint(boot.progressionToken)).hint.hintValue).toBe(firstHint);
    readEligiblePuzzle.mockClear();
    await expect(edition(first).getBootstrap(date, 'points-v3')).rejects.toThrow();
    const wrongRuleset = tokens.sign({ ...tokens.verify(boot.progressionToken), rulesetVersion: 'points-v3' });
    await expect(edition(first).getHintBundle(wrongRuleset)).rejects.toThrow();
    await expect(edition(second).revealHint(boot.progressionToken)).rejects.toThrow();
    await expect(edition(second).getHintBundle('invalid')).rejects.toThrow();
    expect(readEligiblePuzzle).not.toHaveBeenCalled();
  });

  it('refuses unavailable, mismatched and wrong-date publications', async () => {
    for (const publication of [null, { ...puzzle(), id: second }, { ...puzzle(), id: first, puzzleDate: '2026-11-07' }]) {
      const runtime = createExactIdDailyRuntimeService({
        puzzleId: first, progressionTokens: tokens, readEligiblePuzzle: async () => publication,
      });
      await expect(runtime.getBootstrap(date)).rejects.toThrow();
    }
  });
});
