// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scorecard: vi.fn(),
  bootstrap: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('../officialDailyCompetitiveHttpTransport', () => ({
  createOfficialDailyCompetitiveHttpTransport: () => ({
    scorecard: mocks.scorecard, bootstrap: mocks.bootstrap,
  }),
}));
vi.mock('../competitiveDailyLocalHint', () => ({
  restoreCompetitiveHintSafely: (bootstrap: unknown) => bootstrap,
}));
vi.mock('../dailyAtBatOwnershipCoordinator', () => ({
  getBrowserDailyAtBatLockPort: () => ({
    requestExclusive: mocks.lock,
  }),
}));
vi.mock('./DailyInningGame', () => ({
  DailyInningGame: ({ onCompetitiveActionFailure }: {
    onCompetitiveActionFailure?: () => void;
  }) => React.createElement('button', {
    type: 'button', onClick: onCompetitiveActionFailure,
  }, 'Simulate competitive action failure'),
}));

import { CompetitiveDailyGame } from './CompetitiveDailyGame';

const PUZZLE_ID = 'daily-ed-v1-907f33db-c38f-43c3-8e6b-a3aaf19bbd08';
const DATE = '2026-11-19';
const winner = {
  status: 'active' as const,
  bootstrap: {
    progressionToken: 'sql-winner-signed-token',
    puzzle: { id: PUZZLE_ID, puzzleDate: DATE },
    rulesetVersion: 'points-v4',
    hintBundle: { revealedCount: 0, hints: [], checkpoints: [] },
  },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.scorecard.mockReset().mockResolvedValue(winner);
  mocks.bootstrap.mockReset();
  mocks.lock.mockReset().mockImplementation((_key: string, _signal: AbortSignal,
    callback: () => Promise<void>) => {
    // The real exclusive callback remains held until unmount. For this view
    // test, run it without waiting on the indefinitely held lock promise.
    void callback();
    return Promise.resolve();
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container!);
});

afterEach(async () => {
  if (root !== null) await act(async () => { root!.unmount(); });
  container?.remove();
  root = null;
  container = null;
});

describe('competitive Daily authoritative response-loss recovery', () => {
  it('remounts from the exact edition scorecard after a failed action without replaying it', async () => {
    await act(async () => {
      root!.render(<CompetitiveDailyGame puzzleId={PUZZLE_ID} date={DATE} />);
    });
    expect(container!.textContent).toContain('Simulate competitive action failure');
    expect(mocks.scorecard).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrap).not.toHaveBeenCalled();

    await act(async () => {
      (container!.querySelector('button') as HTMLButtonElement).click();
    });
    expect(mocks.scorecard).toHaveBeenCalledTimes(2);
    expect(mocks.scorecard).toHaveBeenNthCalledWith(1, DATE);
    expect(mocks.scorecard).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Simulate competitive action failure');
    expect(mocks.lock.mock.calls.map(call => call[0])).toEqual([
      'official-daily-competitive:' + PUZZLE_ID,
      'official-daily-competitive:' + PUZZLE_ID,
    ]);
  });
});
