import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./check-file-sizes.mjs', import.meta.url));
function checkFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'initial-baseball-file-sizes-'));
  try {
    for (const [path, lines] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Array(lines).fill('// fixture').join('\n'));
    }
    return spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('ignores generated Next output while accepting the 500-line source boundary', () => {
  const result = checkFixture({
    'apps/web/.next/types/validator.ts': 647,
    'apps/web/.next/server/app/page.js': 1200,
    'apps/web/app/page.tsx': 500,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /File size check passed/);
});

test('still rejects oversized handwritten source beside generated Next output', () => {
  const result = checkFixture({
    'apps/web/.next/types/validator.ts': 647,
    'apps/web/app/page.tsx': 501,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/web\/app\/page\.tsx has 501 lines/);
  assert.doesNotMatch(result.stderr, /\.next/);
});

test('only ignores the exact generated directory name', () => {
  const result = checkFixture({ 'apps/web/.next-custom/page.tsx': 501 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.next-custom\/page\.tsx/);
});
