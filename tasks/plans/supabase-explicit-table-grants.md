# Explicit table-grants guard for new Supabase public migrations

## Scope contract
- **Goal:** Prevent newly added public-table migrations from depending on automatic Data API grants after October 30, 2026.
- **Owning layer:** Repository CI and Supabase migration workflow.
- **In scope:** A narrow added-migration-only static gate requiring explicit schema-qualified CREATE TABLE, RLS, REVOKE of public/anon/authenticated, and least-privilege GRANT to service_role; tests and operations docs.
- **Out of scope:** Production permission changes, retroactive grant sweeps, new migrations or tables, authentication, game logic, WAF or public Custom creator activation.
- **Acceptance:** Unit tests for missing grants, multi-table migrations, comments, RLS and role semantics; new check runs in PR CI with exact base/head; independent review, READY Preview and production checks.
- **Stop:** New browser-role access or complex SQL that the static gate cannot reliably interpret requires a separate security review, never an automatic global grant.

## Architecture
New `public` tables are server-private by default for Initial Baseball. The repository already uses explicit service_role grants and browser-role revocations for protected Daily and Custom tables. This change adds a preventive CI check for newly added migration SQL files; legacy migrations are unchanged. Schema replay and hosted grants still require human review. Functions' EXECUTE privileges remain a separate concern.

The guard reads only added SQL paths from Git using the PR base/head and does not connect to Supabase or touch any live data. It is deliberately a basic syntactic check, not a SQL parser or assurance that a browser-facing policy is safe.

## Documentation impact
Updated `supabase/README.md` and `tasks/todo.md`, and added this bounded plan. CI workflow change is explicitly documented; no production config or database changes.
