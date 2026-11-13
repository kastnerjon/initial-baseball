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


// This is a review-completeness gate, not proof of actual user-experience parity.
const GAMEPLAY_PREFIXES = [
  'apps/web/app/components/', 'apps/web/app/daily/', 'apps/web/app/archive/',
  'apps/web/app/api/daily/', 'apps/web/app/api/custom-lineup/',
  'apps/web/app/api/custom-nine/', 'packages/daily/src/', 'packages/engine/src/',
];
const GAMEPLAY_ENTRY_POINTS = new Set([
  'apps/web/app/page.tsx',
  'apps/web/app/serverCanonicalRuntime.ts',
  'apps/web/app/serverCanonicalData.ts',
  'apps/web/app/api/players/search/route.ts',
]);
const GAMEPLAY_ROOT = /^apps\/web\/app\/[^/]*(?:daily|Daily|hint|Hint|game|Game|archive|Archive|official|Official|custom|Custom|score|Score)[^/]*\.(?:ts|tsx|js|mjs)$/;
const PARITY_FIELDS = ['Baseline', 'Shared path', 'Interaction/network differences', 'Verification', 'Approved divergence'];

export function classifyGameplayChanges(changedFiles) {
  return changedFiles.filter((file) =>
    GAMEPLAY_PREFIXES.some((prefix) => file.startsWith(prefix))
    || GAMEPLAY_ENTRY_POINTS.has(file) || GAMEPLAY_ROOT.test(file));
}

export function validateGameplayParity({ changedFiles, prBody }) {
  const gameplayChanges = classifyGameplayChanges(changedFiles);
  if (!gameplayChanges.length) return gameplayChanges;
  const heading = /^## Gameplay parity\s*$/m.exec(prBody);
  if (!heading) throw new DocumentationImpactError('Gameplay code changes require a "## Gameplay parity" PR section.');
  const after = prBody.slice(heading.index + heading[0].length);
  const next = /^## /m.exec(after);
  const section = next ? after.slice(0, next.index) : after;
  for (const field of PARITY_FIELDS) {
    const label = '- **' + field + ':**';
    const line = section.split('\n').find((candidate) => candidate.trimStart().startsWith(label));
    const answer = line?.trimStart().slice(label.length).trim() ?? '';
    const unformatted = answer.replace(/^[\s`*_~]+/, '').trim();
    if (answer.length < 12 || /^(?:<!--|tbd\b|todo\b|n\/a\b|not applicable\b|\.\.\.)/i.test(unformatted)) {
      throw new DocumentationImpactError('Gameplay parity needs a concrete "' + field + '" assessment.');
    }
  }
  return gameplayChanges;
}

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

  const gameplayChanges = validateGameplayParity({ changedFiles, prBody });
  return { materialChanges, canonicalChanges, handoffChanges, gameplayChanges, exception };
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
