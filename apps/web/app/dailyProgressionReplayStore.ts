import { createHash, randomUUID } from 'node:crypto';
import { getCache } from '@vercel/functions';
import type {
  DailyHintResponse,
  DailyResolutionResponse,
} from './dailyRuntimeContracts';

const REPLAY_CACHE_TTL_SECONDS = 60 * 60 * 48;
const CLAIM_STABILIZATION_MS = 75;
const CACHE_NAMESPACE = 'initial-baseball-daily-progression';

type ReplayResponse = DailyHintResponse | DailyResolutionResponse;

type ReplaySessionRecord = {
  schemaVersion: 1;
  phase: 'ready' | 'claim';
  currentTokenHash: string | null;
  lastConsumedTokenHash: string | null;
  lastActionHash: string | null;
  lastResponse: ReplayResponse | null;
  claimId: string | null;
  claimActionHash: string | null;
};

export type DailyProgressionReplayStore = {
  initialize: (input: {
    sessionId: string;
    progressionToken: string;
  }) => Promise<void>;
  execute: <Response extends ReplayResponse>(input: {
    sessionId: string;
    progressionToken: string;
    actionKey: string;
    createResponse: () => Response | Promise<Response>;
  }) => Promise<Response>;
};

export class DailyProgressionReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyProgressionReplayError';
  }
}

export function createInMemoryDailyProgressionReplayStore(): DailyProgressionReplayStore {
  const records = new Map<string, ReplaySessionRecord>();

  return {
    async initialize({ sessionId, progressionToken }) {
      records.set(sessionId, createInitialRecord(progressionToken));
    },

    execute(input) {
      return withLocalSessionLock(input.sessionId, async () => {
        const record = records.get(input.sessionId);
        const replayedResponse = resolveReplayedAction(record, input);
        if (replayedResponse !== null) {
          return replayedResponse;
        }
        requireCurrentToken(record, input.progressionToken);

        const response = await input.createResponse();
        records.set(
          input.sessionId,
          createCompletedRecord(record, input, response),
        );
        return response;
      });
    },
  };
}

export function createVercelDailyProgressionReplayStore(): DailyProgressionReplayStore {
  const cache = getCache({ namespace: CACHE_NAMESPACE });

  return {
    async initialize({ sessionId, progressionToken }) {
      await cache.set(sessionId, createInitialRecord(progressionToken), {
        ttl: REPLAY_CACHE_TTL_SECONDS,
        tags: [`daily-session-${sessionId}`],
        name: 'Daily progression session',
      });
    },

    execute(input) {
      return withLocalSessionLock(input.sessionId, async () => {
        const initialRecord = await readCacheRecord(cache, input.sessionId);
        const replayedResponse = resolveReplayedAction(initialRecord, input);
        if (replayedResponse !== null) {
          return replayedResponse;
        }
        requireCurrentToken(initialRecord, input.progressionToken);

        const claimId = randomUUID();
        await writeCacheRecord(cache, input.sessionId, {
          ...initialRecord,
          phase: 'claim',
          claimId,
          claimActionHash: hashValue(input.actionKey),
        });
        await delay(CLAIM_STABILIZATION_MS);

        const claimedRecord = await readCacheRecord(cache, input.sessionId);
        const claimedReplay = resolveReplayedAction(claimedRecord, input);
        if (claimedReplay !== null) {
          return claimedReplay;
        }
        if (
          claimedRecord?.phase !== 'claim'
          || claimedRecord.claimId !== claimId
          || claimedRecord.claimActionHash !== hashValue(input.actionKey)
        ) {
          throw new DailyProgressionReplayError(
            'This Daily action was superseded by another request.',
          );
        }

        const response = await input.createResponse();
        const completedRecord = createCompletedRecord(claimedRecord, input, response);
        await writeCacheRecord(cache, input.sessionId, completedRecord);
        await delay(CLAIM_STABILIZATION_MS);

        const confirmedRecord = await readCacheRecord(cache, input.sessionId);
        const confirmedReplay = resolveReplayedAction(confirmedRecord, input);
        if (confirmedReplay !== null) {
          return confirmedReplay;
        }
        throw new DailyProgressionReplayError(
          'This Daily action could not be confirmed.',
        );
      });
    },
  };
}

function createInitialRecord(progressionToken: string): ReplaySessionRecord {
  return {
    schemaVersion: 1,
    phase: 'ready',
    currentTokenHash: hashValue(progressionToken),
    lastConsumedTokenHash: null,
    lastActionHash: null,
    lastResponse: null,
    claimId: null,
    claimActionHash: null,
  };
}

function createCompletedRecord<Response extends ReplayResponse>(
  record: ReplaySessionRecord,
  input: {
    progressionToken: string;
    actionKey: string;
  },
  response: Response,
): ReplaySessionRecord {
  return {
    ...record,
    phase: 'ready',
    currentTokenHash: response.progressionToken === null
      ? null
      : hashValue(response.progressionToken),
    lastConsumedTokenHash: hashValue(input.progressionToken),
    lastActionHash: hashValue(input.actionKey),
    lastResponse: response,
    claimId: null,
    claimActionHash: null,
  };
}

function resolveReplayedAction<Response extends ReplayResponse>(
  record: ReplaySessionRecord | null | undefined,
  input: {
    progressionToken: string;
    actionKey: string;
  },
): Response | null {
  if (record?.lastConsumedTokenHash !== hashValue(input.progressionToken)) {
    return null;
  }
  if (
    record.lastActionHash === hashValue(input.actionKey)
    && record.lastResponse !== null
  ) {
    return record.lastResponse as Response;
  }
  throw new DailyProgressionReplayError(
    'This Daily progression token has already been consumed.',
  );
}

function requireCurrentToken(
  record: ReplaySessionRecord | null | undefined,
  progressionToken: string,
): asserts record is ReplaySessionRecord {
  if (
    record?.phase !== 'ready'
    || record.currentTokenHash !== hashValue(progressionToken)
  ) {
    throw new DailyProgressionReplayError(
      'This Daily progression token is invalid, stale, or already in use.',
    );
  }
}

async function readCacheRecord(
  cache: ReturnType<typeof getCache>,
  sessionId: string,
): Promise<ReplaySessionRecord | null> {
  const value = await cache.get(sessionId);
  return isReplaySessionRecord(value) ? value : null;
}

async function writeCacheRecord(
  cache: ReturnType<typeof getCache>,
  sessionId: string,
  record: ReplaySessionRecord,
): Promise<void> {
  await cache.set(sessionId, record, {
    ttl: REPLAY_CACHE_TTL_SECONDS,
    tags: [`daily-session-${sessionId}`],
    name: 'Daily progression session',
  });
}

function isReplaySessionRecord(value: unknown): value is ReplaySessionRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 1
    && (record.phase === 'ready' || record.phase === 'claim')
    && (typeof record.currentTokenHash === 'string' || record.currentTokenHash === null)
    && (typeof record.lastConsumedTokenHash === 'string' || record.lastConsumedTokenHash === null)
    && (typeof record.lastActionHash === 'string' || record.lastActionHash === null)
    && (typeof record.claimId === 'string' || record.claimId === null)
    && (typeof record.claimActionHash === 'string' || record.claimActionHash === null)
  );
}

const localSessionLocks = new Map<string, Promise<void>>();

async function withLocalSessionLock<Value>(
  sessionId: string,
  task: () => Promise<Value>,
): Promise<Value> {
  const previous = localSessionLocks.get(sessionId) ?? Promise.resolve();
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate);
  localSessionLocks.set(sessionId, current);
  await previous;

  try {
    return await task();
  } finally {
    release();
    if (localSessionLocks.get(sessionId) === current) {
      localSessionLocks.delete(sessionId);
    }
  }
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
