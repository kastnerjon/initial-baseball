#!/usr/bin/env node
// Read-only PR workstream audit. Filename overlap is not a merge-conflict proof.
import { pathToFileURL } from 'node:url';

const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const isCode = path => !/^(docs\/|tasks\/)/.test(path)
  && !['AGENTS.md', 'README.md', 'CONTRIBUTING.md'].includes(path);
// CommonMark permits escaping every ASCII punctuation character. Escape the
// backslash too, so untrusted paths/refs cannot cancel an escape or add markup.
const safe = value => String(value).replace(/[\r\n]/g, ' ')
  .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '\\$&');

export function collectChangedPaths(files) {
  return [...new Set(files.flatMap(file => file.status === 'renamed'
    ? [file.filename, file.previous_filename].filter(path => typeof path === 'string')
    : [file.filename]))];
}

export function analyzeWorkstreams(pulls, filesByNumber) {
  const direct = pulls.filter(p => p.base.ref === 'main').sort((a, b) => a.number - b.number);
  const stacked = pulls.filter(p => p.base.ref !== 'main').sort((a, b) => a.number - b.number);
  const collisions = [];
  for (let i = 0; i < direct.length; i++) {
    for (let j = i + 1; j < direct.length; j++) {
      const a = direct[i], b = direct[j];
      const aFiles = new Set(filesByNumber.get(a.number) ?? []);
      const shared = [...new Set(filesByNumber.get(b.number) ?? [])]
        .filter(path => aFiles.has(path)).sort();
      if (shared.length) collisions.push({
        a: a.number, b: b.number,
        source: shared.filter(isCode),
        coordination: shared.filter(path => !isCode(path)),
      });
    }
  }
  return { direct, stacked, collisions };
}

export function renderWorkstreams(pulls, filesByNumber) {
  const { direct, stacked, collisions } = analyzeWorkstreams(pulls, filesByNumber);
  const lines = [
    '# Initial Baseball — PR workstream audit', '',
    'Read-only. Same-file overlap is not proof of an actual merge conflict.',
    'Exact-head CI, independent review, Preview and QA are separate requirements.', '',
    'Open PRs: ' + pulls.length + '; direct to main: ' + direct.length
      + '; stacked: ' + stacked.length, '',
    '## Source path overlaps between direct-to-main PRs',
  ];
  const source = collisions.filter(c => c.source.length);
  if (!source.length) lines.push('None detected.');
  for (const c of source) {
    lines.push('- #' + safe(c.a) + ' / #' + safe(c.b) + ': '
      + c.source.slice(0, 8).map(safe).join(', ')
      + (c.source.length > 8 ? ' (+' + (c.source.length - 8) + ' more)' : ''));
  }
  lines.push('', '## Stacked PRs: sequencing dependencies, not parallel work');
  if (!stacked.length) lines.push('None.');
  for (const p of stacked) lines.push('- #' + safe(p.number) + ': base '
    + safe(p.base.ref) + ', head ' + safe(p.head.ref));
  lines.push('', '## Shared coordination/doc paths');
  const docs = collisions.filter(c => c.coordination.length);
  if (!docs.length) lines.push('None detected.');
  for (const c of docs) {
    lines.push('- #' + safe(c.a) + ' / #' + safe(c.b) + ': '
      + c.coordination.slice(0, 8).map(safe).join(', ')
      + (c.coordination.length > 8 ? ' (+' + (c.coordination.length - 8) + ' more)' : ''));
  }
  lines.push('', '## Integration rules',
    '1. Isolate each assigned task in a separate branch/worktree; single-owner critical scoring and schema.',
    '2. Reconcile against latest main; source overlap is a review signal, not automatic rejection.',
    '3. Require exact-head CI, genuine independent review, matching Preview and relevant QA.',
    '4. No product flags or production migrations are changed by this report.', '');
  return lines.join('\n');
}

async function getAll(repository, resource, token) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL('https://api.github.com/repos/' + repository + '/' + resource);
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    const response = await fetch(url, {
      headers: { accept: 'application/vnd.github+json',
        authorization: 'Bearer ' + token,
        'x-github-api-version': '2022-11-28' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw Error('GitHub read failed for ' + resource + ': HTTP ' + response.status);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error('Expected paginated GitHub array for ' + resource);
    items.push(...rows);
    if (rows.length < PAGE_SIZE) return items;
  }
  throw Error('GitHub pagination limit reached for ' + resource + '; audit incomplete');
}

export async function main(environment = process.env) {
  const repo = environment.GITHUB_REPOSITORY;
  const token = environment.GITHUB_TOKEN;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) {
    throw Error('Expected GITHUB_REPOSITORY owner/repo');
  }
  if (!token) throw Error('GITHUB_TOKEN required for read-only API');
  const pulls = await getAll(repo, 'pulls?state=open', token);
  const filesByNumber = new Map();
  for (let i = 0; i < pulls.length; i += 5) {
    await Promise.all(pulls.slice(i, i + 5).map(async p => {
      const files = await getAll(repo, 'pulls/' + p.number + '/files', token);
      filesByNumber.set(p.number, collectChangedPaths(files));
    }));
  }
  process.stdout.write(renderWorkstreams(pulls, filesByNumber) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Workstream audit failed');
    process.exitCode = 1;
  });
}
