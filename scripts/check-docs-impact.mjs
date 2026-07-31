import { execFileSync } from 'node:child_process';

const baseSha = process.env.BASE_SHA?.trim();
const headSha = process.env.HEAD_SHA?.trim();
const prBody = process.env.PR_BODY ?? '';

if (!baseSha || !headSha) {
  console.error('BASE_SHA and HEAD_SHA are required.');
  process.exit(1);
}

const changedFiles = execFileSync('git', ['diff', '--name-only', baseSha, headSha], {
  encoding: 'utf8',
})
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const documentationHeader = /^## Documentation impact\s*$/im;
if (!documentationHeader.test(prBody)) {
  fail('PR body must contain an exact "## Documentation impact" section.');
}

const canonicalDocs = new Set([
  'docs/START-HERE.md',
  'docs/product/daily-inning-blueprint.md',
  'docs/product/lineup-content-system.md',
  'docs/architecture-and-scale-plan.md',
  'docs/engineering/documentation-governance.md',
  'docs/spec/data-model.md',
  'docs/spec/engine.md',
  'docs/spec/api.md',
  'tasks/todo.md',
  'tasks/lessons.md',
]);

const materialPrefixes = [
  'apps/web/app/',
  'packages/shared/src/',
  'packages/engine/src/',
  'packages/baseball-data/src/',
  'packages/baseball-data/scripts/',
  'packages/daily/src/',
  'supabase/migrations/',
  '.github/workflows/',
];

const materialExactFiles = new Set([
  'AGENTS.md',
  'package.json',
  'pnpm-lock.yaml',
  'turbo.json',
  'vercel.json',
]);

const operationalPrefixes = ['supabase/migrations/', '.github/workflows/'];
const operationalExactFiles = new Set(['vercel.json']);

const materialChanges = changedFiles.filter(
  (file) =>
    materialExactFiles.has(file) ||
    materialPrefixes.some((prefix) => file.startsWith(prefix)),
);

const canonicalChanges = changedFiles.filter((file) => canonicalDocs.has(file));
const handoffChanges = changedFiles.filter(
  (file) => file === 'docs/START-HERE.md' || file === 'tasks/todo.md',
);

const exception = readDocumentationException(prBody);
const validException = exception !== null;

if (materialChanges.length > 0 && canonicalChanges.length === 0 && !validException) {
  fail(
    [
      'Material files changed without a canonical documentation update.',
      'Update an affected canonical document or add a specific line:',
      'Documentation exception: <why current documented behavior remains accurate>',
      '',
      'Material files:',
      ...materialChanges.map((file) => `- ${file}`),
    ].join('\n'),
  );
}

const operationalChanges = materialChanges.filter(
  (file) =>
    operationalExactFiles.has(file) ||
    operationalPrefixes.some((prefix) => file.startsWith(prefix)),
);

if (
  operationalChanges.length > 0 &&
  handoffChanges.length === 0 &&
  !validException
) {
  fail(
    [
      'Operationally sensitive files changed without updating the handoff or active task list.',
      'Update docs/START-HERE.md or tasks/todo.md, or provide a specific Documentation exception.',
      '',
      'Operational files:',
      ...operationalChanges.map((file) => `- ${file}`),
    ].join('\n'),
  );
}

console.log('Documentation impact check passed.');
console.log(`Changed files: ${changedFiles.length}`);
console.log(`Material files: ${materialChanges.length}`);
console.log(`Canonical docs changed: ${canonicalChanges.length}`);
if (validException) {
  console.log(`Documentation exception accepted: ${exception}`);
}

function readDocumentationException(body) {
  const match = body.match(/^Documentation exception:\s*(.+)$/im);
  if (!match) return null;

  const value = match[1].trim();
  const placeholderOrEmpty =
    value.length < 12 ||
    /^(none|n\/a|na|not applicable|no impact|no docs? needed|<!--)/i.test(value);

  return placeholderOrEmpty ? null : value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
