import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const buildDirectory = resolve(process.cwd(), '.next');
const initialPayloadPaths = [
  resolve(buildDirectory, 'server/app/index.html'),
  resolve(buildDirectory, 'server/app/index.rsc'),
].filter(existsSync);
const clientChunkPaths = walkFiles(resolve(buildDirectory, 'static/chunks'))
  .filter((path) => path.endsWith('.js'));
const canonicalIdPattern = /ibp_[0-9a-f]{20}/;
const legacyIdPattern = /chadwick:[0-9a-f]{8}/;

if (initialPayloadPaths.length === 0) {
  throw new Error('Could not find the built initial page payload for hidden-answer QA.');
}

for (const path of initialPayloadPaths) {
  const content = readFileSync(path, 'utf8');
  assertAbsent(path, content, canonicalIdPattern, 'canonical player ID');
  assertAbsent(path, content, legacyIdPattern, 'legacy player ID');
  for (const privateField of ['correctPlayerId', 'revealShard', 'careerStats', 'dailyEligibilityTier']) {
    assertAbsent(path, content, new RegExp(privateField), `private field ${privateField}`);
  }
}

for (const path of clientChunkPaths) {
  const content = readFileSync(path, 'utf8');
  assertAbsent(path, content, canonicalIdPattern, 'embedded canonical player ID');
  assertAbsent(path, content, legacyIdPattern, 'embedded legacy player ID');
}

const clientBytes = clientChunkPaths.reduce((total, path) => total + statSync(path).size, 0);
console.log(
  `Hidden-answer build QA passed for ${initialPayloadPaths.length} initial payloads and ${clientChunkPaths.length} client chunks (${clientBytes} bytes).`,
);

function assertAbsent(path, content, pattern, label) {
  if (pattern.test(content)) {
    throw new Error(`Hidden-answer build QA found ${label} in ${path}.`);
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}
