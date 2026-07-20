import type {
  CanonicalIdResolution,
  CanonicalPlayerIndexEntry,
  CanonicalPlayerIndexPayload,
  CanonicalPlayerReveal,
  CanonicalRedirectPayload,
  CanonicalRevealShardPayload,
} from './types.js';

const CANONICAL_ID_PATTERN = /^ibp_([0-9a-f]{2})[0-9a-f]{18}$/;

export class CanonicalRuntimeDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalRuntimeDataError';
  }
}
export type CanonicalRuntimeAccessor = {
  getPlayerIndex: () => readonly CanonicalPlayerIndexEntry[];
  getPlayer: (playerId: string) => CanonicalPlayerIndexEntry | null;
  resolvePlayerId: (playerId: string) => CanonicalIdResolution;
  requireCanonicalPlayerId: (playerId: string) => string;
  getReveal: (playerId: string) => CanonicalPlayerReveal;
};

type CreateCanonicalRuntimeAccessorInput = {
  playerIndex: CanonicalPlayerIndexPayload;
  redirects: CanonicalRedirectPayload;
  loadRevealShard: (path: string) => CanonicalRevealShardPayload;
};

export function createCanonicalRuntimeAccessor({
  playerIndex,
  redirects,
  loadRevealShard,
}: CreateCanonicalRuntimeAccessorInput): CanonicalRuntimeAccessor {
  assertSchemaVersion(playerIndex.schemaVersion, 'player index');
  assertSchemaVersion(redirects.schemaVersion, 'legacy redirects');

  const playerById = new Map<string, CanonicalPlayerIndexEntry>();
  const exclusionsByLegacyId = new Map(
    redirects.excludedRedirects.map((entry) => [entry.legacyPlayerId, entry]),
  );

  for (const player of playerIndex.players) {
    assertCanonicalPlayerIndexEntry(player);
    if (playerById.has(player.playerId)) {
      throw new CanonicalRuntimeDataError(`Duplicate canonical player index ID: ${player.playerId}`);
    }
    playerById.set(player.playerId, player);
  }

  for (const [legacyPlayerId, canonicalPlayerId] of Object.entries(redirects.redirects)) {
    if (!playerById.has(canonicalPlayerId)) {
      throw new CanonicalRuntimeDataError(
        `Legacy redirect ${legacyPlayerId} targets missing runtime player ${canonicalPlayerId}.`,
      );
    }
  }

  return {
    getPlayerIndex: () => playerIndex.players,
    getPlayer(playerId) {
      const resolution = resolvePlayerId(playerId);
      return resolution.status === 'canonical' || resolution.status === 'redirected'
        ? playerById.get(resolution.playerId) ?? null
        : null;
    },
    resolvePlayerId,
    requireCanonicalPlayerId(playerId) {
      const resolution = resolvePlayerId(playerId);
      if (resolution.status === 'canonical' || resolution.status === 'redirected') {
        return resolution.playerId;
      }
      if (resolution.status === 'excluded') {
        throw new CanonicalRuntimeDataError(
          `Legacy player ID ${resolution.legacyPlayerId} is excluded: ${resolution.reason}.`,
        );
      }
      throw new CanonicalRuntimeDataError(`Unknown player ID: ${resolution.requestedPlayerId}.`);
    },
    getReveal(playerId) {
      const canonicalPlayerId = this.requireCanonicalPlayerId(playerId);
      const indexEntry = playerById.get(canonicalPlayerId);
      if (indexEntry === undefined) {
        throw new CanonicalRuntimeDataError(`Missing player index entry: ${canonicalPlayerId}.`);
      }

      const shard = loadRevealShard(indexEntry.revealShard);
      assertSchemaVersion(shard.schemaVersion, `reveal shard ${indexEntry.revealShard}`);
      const expectedShardId = getShardId(canonicalPlayerId);
      if (shard.shardId !== expectedShardId) {
        throw new CanonicalRuntimeDataError(
          `Reveal shard ${indexEntry.revealShard} identifies itself as ${shard.shardId}, expected ${expectedShardId}.`,
        );
      }

      const reveal = shard.players[canonicalPlayerId];
      if (reveal === undefined) {
        throw new CanonicalRuntimeDataError(
          `Reveal shard ${indexEntry.revealShard} does not contain ${canonicalPlayerId}.`,
        );
      }
      if (reveal.playerId !== canonicalPlayerId) {
        throw new CanonicalRuntimeDataError(
          `Reveal record ID ${reveal.playerId} does not match requested ID ${canonicalPlayerId}.`,
        );
      }
      return reveal;
    },
  };

  function resolvePlayerId(playerId: string): CanonicalIdResolution {
    if (playerById.has(playerId)) {
      return { status: 'canonical', playerId };
    }
    const redirectedPlayerId = redirects.redirects[playerId];
    if (redirectedPlayerId !== undefined) {
      return { status: 'redirected', playerId: redirectedPlayerId, legacyPlayerId: playerId };
    }
    const exclusion = exclusionsByLegacyId.get(playerId);
    if (exclusion !== undefined) {
      return {
        status: 'excluded',
        playerId: exclusion.playerId,
        legacyPlayerId: exclusion.legacyPlayerId,
        reason: exclusion.reason,
      };
    }
    return { status: 'unknown', requestedPlayerId: playerId };
  }
}

function assertCanonicalPlayerIndexEntry(player: CanonicalPlayerIndexEntry): void {
  const expectedShard = `reveal-shards/${getShardId(player.playerId)}.json`;
  if (player.revealShard !== expectedShard) {
    throw new CanonicalRuntimeDataError(
      `Player ${player.playerId} points to ${player.revealShard}, expected ${expectedShard}.`,
    );
  }
}

function getShardId(playerId: string): string {
  const match = CANONICAL_ID_PATTERN.exec(playerId);
  const shardId = match?.[1];
  if (shardId === undefined) {
    throw new CanonicalRuntimeDataError(`Invalid canonical player ID: ${playerId}.`);
  }
  return shardId;
}

function assertSchemaVersion(schemaVersion: number, label: string): void {
  if (schemaVersion !== 1) {
    throw new CanonicalRuntimeDataError(`Unsupported ${label} schema version: ${schemaVersion}.`);
  }
}
