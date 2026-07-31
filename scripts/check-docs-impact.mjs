import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CANONICAL_DOCS = new Set([
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

const MATERIAL_PREFIXES = [
  'apps/web/',
  'packages/shared/',
  'packages/engine/',
  'packages/baseball-data/',
  'packages/daily/',
  'supabase/',
  '.github/workflows/',
  'scripts/',
];

const MATERIAL_EXACT_FILES = new Set([
  'AGENTS.md',
  'package.json',
  'pnpm-lock.yaml',
  'turbo.json',
  'vercel.json',
]);

const OPERATIONAL_PREFIXES = [
  'supabase/migrations/',
  'supabase/functions/',
  '.github/workflows/',
];

const OPERATIONAL_EXACT_FILES = new Set([
  'vercel.json',
  'apps/web/next.config.js',
  'apps/web/next.config.mjs',
  'apps/web/next.config.ts',
]);

export function main({
  baseSha = process.env.BASE_SHA?.trim(),
  headSha = process.env.HEAD_SHA?.trim(),
  prBody = process.env.PR_BODY ?? '',
  cwd = process.cwd(),
} = {}) {
  if (!baseSha || !headSha) {
    throw new DocumentationImpactError('BASE_SHA and HEAD_SHA are required.');
  }

  const changedFiles = listPullRequestFiles(baseSha, headSha, cwd);
  validateDocumentationImpact({ changedFiles, prBody });

  console.log('Documentation impact check passed.');
  console.log(`Changed files: ${changedFiles.length}`);
  console.log(`Material files: ${classifyMaterialChanges(changedFiles).length}`);
  console.log(
    `Canonical docs changed: ${changedFiles.filter((file) => CANONICAL_DOCS.has(file)).length}`,
  );

  const exception = readDocumentationException(prBody);
  if (exception !== null) {
    console.log(`Documentation exception accepted: ${exception}`);
  }
}

export function listPullRequestFiles(baseSha, headSha, cwd = process.cwd()) {
  return execFileSync(
    'git',
    ['diff', '--name-only', `${baseSha}...${headSha}`],
    { cwd, encoding: 'utf8' },
  )
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

export function validateDocumentationImpact({ changedFiles, prBody }) {
  if (!/^## Documentation impact\s*$/im.test(prBody)) {
    throw new DocumentationImpactError(
      'PR body must contain an exact "## Documentation impact" section.',
    );
  }

  const materialChanges = classifyMaterialChanges(changedFiles);
  const canonicalChanges = changedFiles.filter((file) => CANONICAL_DOCS.has(file));
  const handoffChanges = changedFiles.filter(
    (file) => file === 'docs/START-HERE.md' || file === 'tasks/todo.md',
  );
  const exception = readDocumentationException(prBody);
  const validException = exception !== null;

  if (materialChanges.length > 0 && canonicalChanges.length === 0 && !validException) {
    throw new DocumentationImpactError(
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
      OPERATIONAL_EXACT_FILES.has(file) ||
      OPERATIONAL_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );

  if (
    operationalChanges.length > 0 &&
    handoffChanges.length === 0 &&
    !validException
  ) {
    throw new DocumentationImpactError(
      [
        'Operationally sensitive files changed without updating the handoff or active task list.',
        'Update docs/START-HERE.md or tasks/todo.md, or provide a specific Documentation exception.',
        '',
        'Operational files:',
        ...operationalChanges.map((file) => `- ${file}`),
      ].join('\n'),
    );
  }

  return { materialChanges, canonicalChanges, handoffChanges, exception };
}

export function classifyMaterialChanges(changedFiles) {
  return changedFiles.filter(
    (file) =>
      MATERIAL_EXACT_FILES.has(file) ||
      MATERIAL_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );
}

export function readDocumentationException(body) {
  const match = body.match(/^Documentation exception:\s*(.+)$/im);
  if (!match) return null;

  const value = match[1].trim();
  const placeholderOrEmpty =
    value.length < 12 ||
    /^(none|n\/a|na|not applicable|no impact|no docs? needed|<!--)/i.test(value);

  return placeholderOrEmpty ? null : value;
}

export class DocumentationImpactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DocumentationImpactError';
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
