import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateNewPublicTableGrants } from './check-new-public-table-grants.mjs';

const good = `
CREATE TABLE public.example_results (id text PRIMARY KEY);
ALTER TABLE public.example_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.example_results FROM public, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.example_results TO service_role;
`;

test('accepts explicit least-privilege server-only table migration', () => {
  assert.deepEqual(validateNewPublicTableGrants(good), []);
});

test('accepts multi-table migrations with individual grants', () => {
  const second = good.replaceAll('example_results', 'example_attempts');
  assert.deepEqual(validateNewPublicTableGrants(good + second), []);
});

test('rejects default-privilege reliance even when RLS enabled', () => {
  const errors = validateNewPublicTableGrants(`
    create table public.foo (id integer);
    alter table public.foo enable row level security;
  `);
  assert.ok(errors.some(x => x.includes('REVOKE ALL')));
  assert.ok(errors.some(x => x.includes('GRANT TO service_role')));
});

test('rejects absent RLS, or permissive GRANT ALL', () => {
  assert.ok(validateNewPublicTableGrants(good.replace(/ALTER TABLE[^;]+;/, ''))
    .some(x => x.includes('ENABLE ROW LEVEL SECURITY')));
  assert.ok(validateNewPublicTableGrants(good.replace('GRANT SELECT, INSERT', 'GRANT ALL'))
    .some(x => x.includes('not GRANT ALL')));
});

test('rejects incomplete revocations and grants for the wrong table', () => {
  assert.ok(validateNewPublicTableGrants(good.replace('public, anon, authenticated, service_role', 'anon'))
    .some(x => x.includes('REVOKE ALL')));
  assert.ok(validateNewPublicTableGrants(good.replace('GRANT SELECT, INSERT ON TABLE public.example_results',
    'GRANT SELECT, INSERT ON TABLE public.other'))
    .some(x => x.includes('GRANT TO service_role')));
});

test('ignores commented-out grants and tables', () => {
  const commentedGrant = good.replace('GRANT SELECT, INSERT', '-- GRANT SELECT, INSERT');
  assert.ok(validateNewPublicTableGrants(commentedGrant).some(x => x.includes('GRANT TO service_role')));
  assert.deepEqual(validateNewPublicTableGrants('-- create table public.future_secrets (id int);'), []);
});

test('allows function-only changes and table alterations with no new CREATE TABLE', () => {
  assert.deepEqual(validateNewPublicTableGrants('alter table public.example_results add column v int;'), []);
  assert.deepEqual(validateNewPublicTableGrants('create function public.f() returns int language sql as $$ select 1 $$;'), []);
});

test('rejects unqualified CREATE TABLE regardless of schema search_path', () => {
  assert.ok(validateNewPublicTableGrants('create table example_results (id text);')
    .some(x => x.includes('specify its schema')));
});

test('requires PUBLIC revocation even when table name contains public schema', () => {
  const incomplete = good.replace('FROM public, anon, authenticated, service_role',
    'FROM anon, authenticated, service_role');
  assert.ok(validateNewPublicTableGrants(incomplete)
    .some(x => x.includes('REVOKE ALL')));
});

test('supports direct service-role grants without optional TABLE keyword', () => {
  assert.deepEqual(validateNewPublicTableGrants(
    good.replaceAll('ON TABLE public.example_results', 'ON public.example_results'),
  ), []);
});
