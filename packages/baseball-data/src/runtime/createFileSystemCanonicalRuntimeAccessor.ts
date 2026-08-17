import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createCanonicalRuntimeAccessor,
  getCanonicalPlayerIdShardId,
  readCanonicalReveal,
  type CanonicalRuntimeAccessor,
} from './createCanonicalRuntimeAccessor.js';
import type {
  CanonicalPlayerIndexPayload,
  CanonicalPlayerReveal,
  CanonicalRedirectPayload,
  CanonicalRevealShardPayload,
} from './types.js';

export type CanonicalRevealReader = {
  getReveal: (canonicalPlayerId: string) => CanonicalPlayerReveal;
};

export function createFileSystemCanonicalRuntimeAccessor(
  runtimeDirectory = resolve(process.cwd(), 'packages/baseball-data/reports/canonical-runtime-payload'),
): CanonicalRuntimeAccessor {
  const playerIndex = readJson<CanonicalPlayerIndexPayload>(resolve(runtimeDirectory, 'player-index.json'));
  const redirects = readJson<CanonicalRedirectPayload>(resolve(runtimeDirectory, 'legacy-redirects.json'));
  const loadRevealShard = createRevealShardLoader(runtimeDirectory);
  return createCanonicalRuntimeAccessor({ playerIndex, redirects, loadRevealShard });
}

export function createFileSystemCanonicalRevealReader(
  runtimeDirectory = resolve(process.cwd(), 'packages/baseball-data/reports/canonical-runtime-payload'),
): CanonicalRevealReader {
  const loadRevealShard = createRevealShardLoader(runtimeDirectory);
  return {
    getReveal(canonicalPlayerId) {
      const shardId = getCanonicalPlayerIdShardId(canonicalPlayerId);
      const path = `reveal-shards/${shardId}.json`;
      return readCanonicalReveal(canonicalPlayerId, path, loadRevealShard);
    },
  };
}

function createRevealShardLoader(runtimeDirectory: string) {
  const shardCache = new Map<string, CanonicalRevealShardPayload>();
  return (path: string): CanonicalRevealShardPayload => {
    const cachedShard = shardCache.get(path);
    if (cachedShard !== undefined) return cachedShard;
    const shard = readJson<CanonicalRevealShardPayload>(resolve(runtimeDirectory, path));
    shardCache.set(path, shard);
    return shard;
  };
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read canonical runtime artifact ${path}: ${message}`);
  }
}
