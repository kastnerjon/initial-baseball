# Production RLS event-trigger helper: EXECUTE privilege hardening (#481)

## Scope and threat boundary

The production database's `public.rls_auto_enable()` is a `postgres`-owned,
`SECURITY DEFINER` function returning `event_trigger`, with
`search_path=pg_catalog`, wired to the enabled `ensure_rls` trigger on
`ddl_command_end`. On October 22, live read-only metadata confirmed `proacl`
is NULL; PostgreSQL's default PUBLIC EXECUTE therefore makes
`has_function_privilege('anon', ..., 'EXECUTE')` and the authenticated
counterpart true. This is an avoidable grant. The event-trigger return type is
not a normal client-callable RPC; this finding alone does **not** demonstrate
an exploitable HTTP endpoint.

Goal: revoke implicit public-API-role EXECUTE without changing the event trigger,
its definition, DDL ownership, existing table RLS, gameplay, or Custom launch
gates. This is separate from the `pg_net` extension advisor finding.

## Migration contract

`supabase/migrations/20261023004439_restrict_rls_auto_enable_execute.sql`
- If this production-specific helper is absent (as independently confirmed in
  the isolated Custom QA project), records a notice and changes nothing.
- If present, fails closed unless its owner/security mode/return type/search path
  and the enabled `ensure_rls` event trigger match reviewed production metadata.
- Revokes EXECUTE from `PUBLIC`, `anon`, and `authenticated`, then asserts
  those two API roles cannot execute the function. The `postgres` owner retains
  full implicit rights. The `service_role` may also lose inherited PUBLIC
  EXECUTE; the trigger's firing must not depend on caller EXECUTE.
- Does not delete, replace or disable `ensure_rls`; does not create a helper in
  projects where none exists. Reapplication is idempotent.

## Bounded verification and evidence

Performed in an ephemeral local PostgreSQL **17.11** database, matching the
observed QA major/minor server version, with an exact copy of the live
production helper body, the enabled `ensure_rls` event trigger, and stand-in
`anon`, `authenticated`, `service_role`, and ordinary DDL-owner roles.

1. Baseline: default PUBLIC EXECUTE confirmed.
2. Transactional revocation: `anon`, `authenticated` and unrelated DDL owner
   lose EXECUTE; owner and event trigger remain intact. An ordinary DDL owner
   created a new public table and trigger enabled RLS automatically. Transaction
   rollback restored the prior ACL and left no table.
3. Exact proposed migration: successful against production-like fixture. A
   second execution was idempotent; public ACL denied while ordinary DDL still
   enabled RLS. Applying in a second empty database (no helper) was a verified
   notice-only no-op. No Supabase QA or production database DDL occurred.

**Evidence limit:** This proves the PostgreSQL mechanism and SQL guards in a
local analogue. It is not hosted, matched Supabase staging acceptance and
does not validate all Supabase control-plane migrations. Do not apply to live
production merely because local tests and PR CI pass.

## Deployment gate and rollback

- Obtain genuine independent review, exact-head CI and Preview.
- Before production application, validate on a suitably matched isolated
  Supabase environment. The existing Custom QA project has no helper, so its
  no-op result cannot substitute for a matched trigger scenario. Verify
  actual `ensure_rls` registration, `pg_proc` metadata, and RLS behavior after
  a new disposable public table under a permitted DDL role; clean up the table.
- Record before/after role privileges and enabled trigger. Do not expose table
  contents, secrets or DDL bodies in public logs.
- After production application, run security advisors and read-only verification:
  `has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')` and the
  authenticated equivalent must both be false; `ensure_rls` must remain enabled.
  Confirm the normal authorized DDL pipeline continues to enable RLS on new
  tables. Never disable RLS globally to silence an advisor.
- Emergency rollback of *only this grant*, if the original production helper
  is still present and ownership matches: `GRANT EXECUTE ON FUNCTION
  public.rls_auto_enable() TO PUBLIC;`. This intentionally restores the
  preexisting implicit privilege and security-advisor warning; investigate
  unexpected trigger behavior before choosing this rollback. Do not drop
  `ensure_rls`.

## Status

Source/matched-local verification complete October 22, 2026. Hosted matched
staging, independent review, and live application are **not complete**.
Custom Lineups public flags remain OFF, and this PR alone is not a launch gate.
