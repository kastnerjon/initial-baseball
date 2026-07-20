import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SNAPSHOT_RELATIVE_DIR = 'data/canonical/identity-snapshot';

export function loadReviewedIdentitySnapshot(packageDir) {
  const snapshotDir = resolve(packageDir, SNAPSHOT_RELATIVE_DIR);
  const manifestPath = resolve(snapshotDir, 'manifest.json');
  const manifestText = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);

  if (
    manifest.schemaVersion !== 1
    || !Array.isArray(manifest.shards)
    || typeof manifest.playerCount !== 'number'
    || !manifest.dispositions
  ) {
    throw new Error('Reviewed canonical identity snapshot manifest is invalid.');
  }

  const players = [];
  const seenCanonicalIds = new Set();
  const seenShardIds = new Set();

  for (const shard of manifest.shards) {
    validateShardManifest(shard, seenShardIds);
    const shardPath = resolve(snapshotDir, shard.path);
    const shardText = readFileSync(shardPath, 'utf8');
    requireSha256(shardText, shard.sha256, shard.path);
    const payload = JSON.parse(shardText);

    if (
      payload.schemaVersion !== 1
      || payload.shardId !== shard.shardId
      || !Array.isArray(payload.players)
      || payload.players.length !== shard.playerCount
    ) {
      throw new Error(`Reviewed identity shard ${shard.path} does not match its manifest.`);
    }

    for (const player of payload.players) {
      if (
        typeof player?.canonicalId !== 'string'
        || player.canonicalId[4] !== shard.shardId
      ) {
        throw new Error(`Reviewed identity shard ${shard.path} contains an invalid player.`);
      }
      if (seenCanonicalIds.has(player.canonicalId)) {
        throw new Error(`Duplicate reviewed canonical identity: ${player.canonicalId}.`);
      }
      seenCanonicalIds.add(player.canonicalId);
      players.push(player);
    }
  }

  if (players.length !== manifest.playerCount) {
    throw new Error(
      `Reviewed identity snapshot contains ${players.length} players; expected ${manifest.playerCount}.`,
    );
  }

  const dispositionsPath = resolve(snapshotDir, manifest.dispositions.path);
  const dispositionsText = readFileSync(dispositionsPath, 'utf8');
  requireSha256(
    dispositionsText,
    manifest.dispositions.sha256,
    manifest.dispositions.path,
  );
  const dispositionsPayload = JSON.parse(dispositionsText);

  if (
    dispositionsPayload.schemaVersion !== 1
    || !Array.isArray(dispositionsPayload.recommendations)
    || dispositionsPayload.recommendations.length
      !== manifest.dispositions.recommendationCount
  ) {
    throw new Error('Reviewed identity disposition snapshot does not match its manifest.');
  }

  return {
    players,
    dispositionRecommendations: dispositionsPayload.recommendations,
    manifest,
    manifestPath: `${SNAPSHOT_RELATIVE_DIR}/manifest.json`,
    manifestSha256: sha256(manifestText),
  };
}

function validateShardManifest(shard, seenShardIds) {
  if (
    !shard
    || typeof shard.shardId !== 'string'
    || !/^[0-9a-f]$/.test(shard.shardId)
    || typeof shard.path !== 'string'
    || typeof shard.playerCount !== 'number'
    || typeof shard.sha256 !== 'string'
  ) {
    throw new Error('Reviewed identity shard manifest entry is invalid.');
  }
  if (seenShardIds.has(shard.shardId)) {
    throw new Error(`Duplicate reviewed identity shard: ${shard.shardId}.`);
  }
  seenShardIds.add(shard.shardId);
}

function requireSha256(content, expected, label) {
  const actual = sha256(content);
  if (actual !== expected) {
    throw new Error(
      `Reviewed identity snapshot checksum mismatch for ${label}: ${actual} !== ${expected}.`,
    );
  }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}
