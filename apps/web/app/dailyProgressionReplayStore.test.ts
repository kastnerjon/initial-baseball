import { describe, expect, it } from 'vitest';
import {
  createInMemoryDailyProgressionReplayStore,
  DailyProgressionReplayError,
} from './dailyProgressionReplayStore';
import type { DailyHintResponse } from './dailyRuntimeContracts';

const INITIAL_TOKEN = 'initial-token';
const NEXT_TOKEN = 'next-token';
const SESSION_ID = 'session-1';

describe('Daily progression replay store', () => {
  it('returns the original response for an exact retry without running the action twice', async () => {
    const store = createInMemoryDailyProgressionReplayStore();
    let executions = 0;
    await store.initialize({ sessionId: SESSION_ID, progressionToken: INITIAL_TOKEN });
    const input = {
      sessionId: SESSION_ID,
      progressionToken: INITIAL_TOKEN,
      actionKey: 'hint:1:0',
      createResponse: () => {
        executions += 1;
        return buildHintResponse(NEXT_TOKEN);
      },
    };

    const first = await store.execute(input);
    const retry = await store.execute(input);

    expect(retry).toEqual(first);
    expect(executions).toBe(1);
  });

  it('rejects a different action that reuses a consumed token', async () => {
    const store = createInMemoryDailyProgressionReplayStore();
    await store.initialize({ sessionId: SESSION_ID, progressionToken: INITIAL_TOKEN });
    await store.execute({
      sessionId: SESSION_ID,
      progressionToken: INITIAL_TOKEN,
      actionKey: 'guess:1:first',
      createResponse: () => buildHintResponse(NEXT_TOKEN),
    });

    await expect(store.execute({
      sessionId: SESSION_ID,
      progressionToken: INITIAL_TOKEN,
      actionKey: 'guess:1:second',
      createResponse: () => buildHintResponse('unreachable'),
    })).rejects.toBeInstanceOf(DailyProgressionReplayError);
  });

  it('serializes simultaneous actions so only one can consume the token', async () => {
    const store = createInMemoryDailyProgressionReplayStore();
    await store.initialize({ sessionId: SESSION_ID, progressionToken: INITIAL_TOKEN });

    const results = await Promise.allSettled([
      store.execute({
        sessionId: SESSION_ID,
        progressionToken: INITIAL_TOKEN,
        actionKey: 'guess:1:first',
        createResponse: async () => {
          await delay(10);
          return buildHintResponse(NEXT_TOKEN);
        },
      }),
      store.execute({
        sessionId: SESSION_ID,
        progressionToken: INITIAL_TOKEN,
        actionKey: 'guess:1:second',
        createResponse: () => buildHintResponse('unreachable'),
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('accepts the successor token after the previous action completes', async () => {
    const store = createInMemoryDailyProgressionReplayStore();
    await store.initialize({ sessionId: SESSION_ID, progressionToken: INITIAL_TOKEN });
    await store.execute({
      sessionId: SESSION_ID,
      progressionToken: INITIAL_TOKEN,
      actionKey: 'hint:1:0',
      createResponse: () => buildHintResponse(NEXT_TOKEN),
    });

    const next = await store.execute({
      sessionId: SESSION_ID,
      progressionToken: NEXT_TOKEN,
      actionKey: 'hint:1:1',
      createResponse: () => buildHintResponse('third-token'),
    });

    expect(next.progressionToken).toBe('third-token');
  });
});

function buildHintResponse(progressionToken: string): DailyHintResponse {
  return {
    hint: {
      hintType: 'main_decade',
      hintLabel: 'Main decade played in',
      hintValue: '2000s',
    },
    progressionToken,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
