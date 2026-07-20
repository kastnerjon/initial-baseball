import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const reviewedSource = JSON.parse(readFileSync(
  resolve(PACKAGE_DIR, 'data/canonical/chadwick-source.json'),
  'utf8',
));
const strict = process.argv.includes('--strict');

runScript('generate-canonical-identities.mjs', [
  '--chadwick-ref',
  reviewedSource.commitSha,
  ...(strict ? ['--strict'] : []),
]);
runScript('generate-identity-review-evidence.mjs');
runScript('recommend-identity-dispositions.mjs');

function runScript(scriptName, args = []) {
  const result = spawnSync(
    process.execPath,
    [resolve(SCRIPT_DIR, scriptName), ...args],
    {
      cwd: PACKAGE_DIR,
      stdio: 'inherit',
      env: process.env,
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
