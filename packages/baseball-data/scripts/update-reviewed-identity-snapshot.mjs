import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const IDENTITIES_PATH = resolve(
  PACKAGE_DIR,
  'reports/canonical-identities/canonical-players.json',
);
const DISPOSITIONS_PATH = resolve(
  PACKAGE_DIR,
  'reports/canonical-identities/identity-disposition-recommendations.json',
);
const REVIEWED_SOURCE_PATH = resolve(
  PACKAGE_DIR,
  'data/canonical/chadwick-source.json',
);
const SNAPSHOT_DIR = resolve(
  PACKAGE_DIR,
  'data/canonical/identity-snapshot',
);
const SHARD_IDS = [...'0123456789abcdef'];
const PRESERVED_MAPPING_SOURCES = new Set([
  'chadwick_person',
  'chadwick_uuid',
  'mlbam',
]);
const checkOnly = process.argv.includes('--check');

const identityArtifact = JSON.parse(readFileSync(IDENTITIES_PATH, 'utf8'));
const dispositionArtifact = JSON.parse(readFileSync(DISPOSITIONS_PATH, 'utf8'));
const reviewedSource = JSON.parse(readFileSync(REVIEWED_SOURCE_PATH, 'utf8'));

validateReviewedSource(identityArtifact.sourceManifest?.chadwick, reviewedSource);

const players = [...(identityArtifact.players ?? [])]
  .map(normalizePlayer)
  .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
const playerShards = new Map(SHARD_IDS.map((shardId) => [shardId, []]));

for (const player of players) {
  const shardId = player.canonicalId.slice(4, 5).toLowerCase();
  const shard = playerShards.get(shardId);
  if (shard === undefined) {
    throw new Error(`Invalid canonical ID for reviewed snapshot: ${player.canonicalId}.`);
  }
  shard.push(player);
}

const expectedFiles = new Map();
const shardManifest = [];
for (const shardId of SHARD_IDS) {
  const path = `players-${shardId}.json`;
  const shardPlayers = playerShards.get(shardId) ?? [];
  const content = compactJson({
    schemaVersion: 1,
    shardId,
    players: shardPlayers,
  });
  expectedFiles.set(path, content);
  shardManifest.push({
    shardId,
    path,
    playerCount: shardPlayers.length,
    sha256: sha256(content),
  });
}

const recommendations = [...(dispositionArtifact.recommendations ?? [])]
  .map(normalizeDisposition)
  .sort((left, right) => (
    String(left.canonicalId ?? '').localeCompare(String(right.canonicalId ?? ''))
    || left.displayName.localeCompare(right.displayName)
  ));
const dispositionsContent = compactJson({
  schemaVersion: 1,
  recommendations,
});
expectedFiles.set('dispositions.json', dispositionsContent);

const manifestContent = prettyJson({
  schemaVersion: 1,
  source: {
    repository: reviewedSource.repository,
    commitSha: reviewedSource.commitSha,
    namesSha256: reviewedSource.namesSha256,
    peopleShardsSha256: reviewedSource.peopleShardsSha256,
  },
  playerCount: players.length,
  shards: shardManifest,
  dispositions: {
    path: 'dispositions.json',
    recommendationCount: recommendations.length,
    sha256: sha256(dispositionsContent),
  },
});
expectedFiles.set('manifest.json', manifestContent);

mkdirSync(SNAPSHOT_DIR, { recursive: true });
const mismatches = [];
for (const [path, content] of expectedFiles) {
  const absolutePath = resolve(SNAPSHOT_DIR, path);
  if (checkOnly) {
    const actual = readFileSync(absolutePath, 'utf8');
    if (actual !== content) {
      mismatches.push(path);
    }
  } else {
    writeFileSync(absolutePath, content);
  }
}

if (mismatches.length > 0) {
  throw new Error(
    `Reviewed canonical identity snapshot is stale: ${mismatches.join(', ')}. `
    + 'Run pnpm --filter @initial-baseball/baseball-data update:canonical-identity-snapshot.',
  );
}

console.log(
  `${checkOnly ? 'Verified' : 'Updated'} reviewed canonical identity snapshot: `
  + `${players.length} players, ${recommendations.length} dispositions, `
  + `${reviewedSource.commitSha}.`,
);

function normalizePlayer(player) {
  return {
    canonicalId: String(player.canonicalId),
    status: String(player.status),
    displayName: String(player.displayName),
    aliases: [...(player.aliases ?? [])],
    legacyPlayerIds: [...(player.legacyPlayerIds ?? [])],
    lahmanPlayerId: player.lahmanPlayerId ?? null,
    sourceMappings: [...(player.sourceMappings ?? [])]
      .filter((mapping) => PRESERVED_MAPPING_SOURCES.has(mapping.source))
      .map((mapping) => ({
        source: String(mapping.source),
        externalId: String(mapping.externalId),
      })),
    firstYear: player.firstYear ?? null,
    lastYear: player.lastYear ?? null,
    weakLahmanCandidates: [...(player.weakLahmanCandidates ?? [])],
  };
}

function normalizeDisposition(recommendation) {
  return {
    canonicalId: recommendation.canonicalId ?? null,
    displayName: String(recommendation.displayName ?? ''),
    recommendedDisposition: String(
      recommendation.recommendedDisposition
      ?? recommendation.disposition
      ?? '',
    ),
    reason: String(recommendation.reason ?? ''),
    legacyPlayerIds: [...(recommendation.legacyPlayerIds ?? [])].sort(),
  };
}

function validateReviewedSource(generatedSource, reviewedSourceValue) {
  if (
    reviewedSourceValue.schemaVersion !== 1
    || generatedSource?.repository !== reviewedSourceValue.repository
    || generatedSource?.resolvedCommitSha !== reviewedSourceValue.commitSha
    || generatedSource?.namesSha256 !== reviewedSourceValue.namesSha256
    || generatedSource?.peopleShardsSha256
      !== reviewedSourceValue.peopleShardsSha256
  ) {
    throw new Error(
      'Generated canonical identities do not match the reviewed Chadwick source pin.',
    );
  }
}

function compactJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}
