import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import { describe, expect, it, vi } from 'vitest';
import { createDailyProgressionTokenCodec } from './dailyProgressionToken';
import { createDailyRuntimeService } from './dailyRuntimeService';

vi.mock('./canonicalRevealViewModel', () => ({
  createCanonicalRevealViewModel: () => ({ playerId: 'ibp_ab000000000000000000' }),
}));

const answerId = 'ibp_ab000000000000000000';
const firstHint = 'PRIVATE_FIRST_HINT_MARKER';
const nextHint = 'PRIVATE_NEXT_BATTER_HINT_MARKER';
const date = '2026-11-06';
const tokens = createDailyProgressionTokenCodec('on-demand-daily-hint-test-secret-0123456789');

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
      progressionToken: boot.progressionToken,
      submittedPlayerId: 'ibp_cd000000000000000000',
    });
    expect(wrong.hintBundle?.hints).toEqual([]);
    expect(wrong.hintBundle?.checkpoints).toEqual([]);

    const next = await runtime.resolveAtBat({
      progressionToken: reveal.progressionToken,
      submittedPlayerId: answerId,
    });
    expect(next.result.kind).toBe('correct');
    expect(next.hintBundle?.pitchNumber).toBe(2);
    expect(next.hintBundle?.hints).toEqual([]);
    expect(next.hintBundle?.checkpoints).toEqual([]);
    expect(JSON.stringify(next)).not.toContain(nextHint);
  });
});
