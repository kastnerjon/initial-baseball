import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReviewedIdentitySnapshot } from './load-reviewed-identity-snapshot.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = resolve(PACKAGE_DIR, 'reports/canonical-identities');
const snapshot = loadReviewedIdentitySnapshot(PACKAGE_DIR);
const sourceManifest = {
  schemaVersion: 1,
  reviewedIdentitySnapshot: {
    path: `packages/baseball-data/${snapshot.manifestPath}`,
    sha256: snapshot.manifestSha256,
    playerCount: snapshot.manifest.playerCount,
  },
  chadwick: {
    repository: snapshot.manifest.source.repository,
    requestedRef: snapshot.manifest.source.commitSha,
    resolvedCommitSha: snapshot.manifest.source.commitSha,
    namesSha256: snapshot.manifest.source.namesSha256,
    peopleShardsSha256: snapshot.manifest.source.peopleShardsSha256,
  },
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeJson(resolve(OUTPUT_DIR, 'canonical-players.json'), {
  schemaVersion: 1,
  sourceManifest,
  players: snapshot.players,
});
writeJson(resolve(OUTPUT_DIR, 'identity-disposition-recommendations.json'), {
  schemaVersion: 1,
  sourceManifest,
  recommendations: snapshot.dispositionRecommendations,
});

console.log(
  `Materialized reviewed canonical identity snapshot: `
  + `${snapshot.players.length} players and `
  + `${snapshot.dispositionRecommendations.length} dispositions.`,
);

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
