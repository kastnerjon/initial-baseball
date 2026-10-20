import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const NEW_PUBLIC_TABLE = /\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)\b/gi;
const CREATED_TABLE = /\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(?:[a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\b/gi;

function withoutComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function statementFor(sql, operation, table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${operation}\\s+[^;]+?\\s+on\\s+(?:table\\s+)?public\\.${escaped}\\s+(?:from|to)\\s+([^;]+)`, 'i');
  return sql.match(regex)?.[0] ?? null;
}

export function validateNewPublicTableGrants(sql, path = 'migration.sql') {
  const source = withoutComments(sql);
  const errors = [];
  for (const match of source.matchAll(CREATED_TABLE)) {
    if (!/\btable\s+(?:if\s+not\s+exists\s+)?[a-z_][a-z0-9_]*\./i.test(match[0])) {
      errors.push(`${path}: CREATE TABLE must specify its schema.`);
    }
  }
  for (const [, table] of source.matchAll(NEW_PUBLIC_TABLE)) {
    const id = `public.${table}`;
    const quoted = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?public\\.${quoted}\\s+enable\\s+row\\s+level\\s+security\\s*;`, 'i').test(source)) {
      errors.push(`${path}: ${id} requires explicit ENABLE ROW LEVEL SECURITY.`);
    }
    const revocation = statementFor(source, 'revoke', table);
    const revokedRoles = revocation?.match(/\bfrom\s+([^;]+)/i)?.[1] ?? '';
    if (!revocation || !/\brevoke\s+all\s+on\b/i.test(revocation)
      || !['public', 'anon', 'authenticated'].every(role => new RegExp(`\\b${role}\\b`, 'i').test(revokedRoles))) {
      errors.push(`${path}: ${id} must explicitly REVOKE ALL FROM public, anon, authenticated.`);
    }
    const grant = statementFor(source, 'grant', table);
    const grantedRoles = grant?.match(/\bto\s+([^;]+)/i)?.[1] ?? '';
    if (!grant || !/\bservice_role\b/i.test(grantedRoles)) {
      errors.push(`${path}: ${id} needs an explicit least-privilege GRANT TO service_role.`);
    } else if (/\bgrant\s+all\s+on\b/i.test(grant)) {
      errors.push(`${path}: ${id} must specify intended privileges, not GRANT ALL.`);
    }
  }
  return errors;
}

export function main({ base = process.env.BASE_SHA, head = process.env.HEAD_SHA, cwd = process.cwd() } = {}) {
  if (!base || !head) throw new Error('BASE_SHA and HEAD_SHA are required.');
  const paths = execFileSync('git', [
    'diff', '--diff-filter=A', '--name-only', `${base}...${head}`, '--', 'supabase/migrations/',
  ], { cwd, encoding: 'utf8' }).trim().split('\n').filter(path => path.endsWith('.sql'));
  const failures = paths.flatMap(path => validateNewPublicTableGrants(readFileSync(`${cwd}/${path}`, 'utf8'), path));
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Explicit Supabase table-grant check passed (${paths.length} added migration files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
