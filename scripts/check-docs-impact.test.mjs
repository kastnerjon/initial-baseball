import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  DocumentationImpactError,
  listPullRequestFiles,
  validateDocumentationImpact,
} from './check-docs-impact.mjs';

const DOCUMENTATION_SECTION = '## Documentation impact\n\nReviewed.';

test('uses the merge base so base-only documentation cannot satisfy a feature PR', () => {
  const repo = createRepository();
  const common = commitFiles(repo, 'common', {
    'docs/START-HERE.md': 'common handoff\n',
    'apps/web/app/page.tsx': 'export default function Page() {}\n',
  });

  exec(repo, ['checkout', '-b', 'feature', common]);
  const featureHead = commitFiles(repo, 'feature runtime change', {
    'apps/web/app/page.tsx': 'export default function Page() { return null; }\n',
  });

  exec(repo, ['checkout', '-b', 'advanced-base', common]);
  const advancedBase = commitFiles(repo, 'base-only docs update', {
    'docs/START-HERE.md': 'advanced base handoff\n',
  });

  const changedFiles = listPullRequestFiles(advancedBase, featureHead, repo);

  assert.deepEqual(changedFiles, ['apps/web/app/page.tsx']);
  assert.throws(
    () => validateDocumentationImpact({ changedFiles, prBody: DOCUMENTATION_SECTION }),
    DocumentationImpactError,
  );
});

test('classifies Next.js runtime configuration as a material operational change', () => {
  const changedFiles = ['apps/web/next.config.mjs'];

  assert.throws(
    () => validateDocumentationImpact({ changedFiles, prBody: DOCUMENTATION_SECTION }),
    /Material files changed/,
  );
});

test('accepts a material change with canonical and handoff documentation', () => {
  const result = validateDocumentationImpact({
    changedFiles: [
      'apps/web/next.config.mjs',
      'docs/architecture-and-scale-plan.md',
      'docs/START-HERE.md',
    ],
    prBody: DOCUMENTATION_SECTION,
  });

  assert.deepEqual(result.materialChanges, ['apps/web/next.config.mjs']);
  assert.equal(result.canonicalChanges.length, 2);
  assert.equal(result.handoffChanges.length, 1);
});

test('accepts a specific exception and rejects placeholders', () => {
  assert.doesNotThrow(() =>
    validateDocumentationImpact({
      changedFiles: ['apps/web/app/page.tsx'],
      prBody: `${DOCUMENTATION_SECTION}\nDocumentation exception: Restores behavior already specified in docs/spec/api.md.`,
    }),
  );

  assert.throws(
    () =>
      validateDocumentationImpact({
        changedFiles: ['apps/web/app/page.tsx'],
        prBody: `${DOCUMENTATION_SECTION}\nDocumentation exception: N/A`,
      }),
    /Material files changed/,
  );
});

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'initial-baseball-docs-impact-'));
  exec(repo, ['init', '-q']);
  exec(repo, ['config', 'user.email', 'tests@example.com']);
  exec(repo, ['config', 'user.name', 'Documentation Test']);
  return repo;
}

function commitFiles(repo, message, files) {
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(repo, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
  exec(repo, ['add', '.']);
  exec(repo, ['commit', '-q', '-m', message]);
  return exec(repo, ['rev-parse', 'HEAD']).trim();
}

function exec(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}
