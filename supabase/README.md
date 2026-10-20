# Supabase

Supabase is the operational persistence layer for Initial Baseball. Portable game, Daily lifecycle, lineup validation, and publication rules live outside Supabase and must not be reimplemented in SQL, triggers, or Edge Functions.

Use migrations for durable schema/extension changes and keep the repository migration files aligned with hosted state. Apply hosted changes deliberately and verify them after deployment.

## Explicit Data API grants for new public tables (October 30, 2026)

Supabase has announced that, beginning October 30, existing projects will no longer automatically grant Data API access to **newly created** tables in the `public` schema. Existing table grants are unchanged. Schema replays in fresh projects, preview branches, and local `supabase db reset` also require explicit grants.

For every **new** `CREATE TABLE public.<name>` migration, include RLS, explicit browser-role revocations and the narrow `service_role` privileges needed by the server **in the same migration**. Example:

```sql
create table public.example_results (id text primary key);
alter table public.example_results enable row level security;
revoke all on table public.example_results from public, anon, authenticated, service_role;
grant select, insert on table public.example_results to service_role;
```

Do not grant `anon` or `authenticated` access as a workaround for a permission-denied error: our answer, hint, scoring, Custom creator and result tables must remain behind server-authoritative access. Any genuine browser-readable table requires a separate security review, explicit RLS policies and narrowly scoped table privileges. **RLS does not replace GRANT, and GRANT does not replace RLS.** Table grants are separate from function EXECUTE grants and schema USAGE privileges.

The pull-request CI check `scripts/check-new-public-table-grants.mjs` inspects newly **added** SQL migration files and requires explicit schema names, RLS, browser-role revocation and least-privilege service-role grants for conventional unquoted public-table definitions. The gate also rejects `GRANT ALL` / `GRANT ALL PRIVILEGES`, subsequent RLS disable commands, and any direct `GRANT` to `PUBLIC`, `anon` or `authenticated` for the new table. Browser-readable tables require a separate security design and explicit modification of this default-private policy. Its regex-based check is a guardrail, **not a full SQL parser, security audit or live role test**. Manually review unusual SQL, existing migrations, grants on functions, and actual hosted role privileges.

Current verified production and isolated QA Custom tables (`custom_nine_issued_challenges`, `custom_nine_completed_results`, `custom_lineup_creation_budgets`) already have RLS and server-role SELECT/INSERT grants, with browser SELECT denied. This change requires no blanket production GRANT or migration rewrite.

For Daily editorial mutations, the authoritative path is the server-side Daily workflow and `packages/daily` lifecycle over the Supabase repository adapter. Do not write `daily_editorial_puzzles` directly from browser code, assistant tooling, SQL transport helpers, or Edge Functions.

The conversational lineup transport is intentionally narrow: `private.dispatch_daily_lineup_chatops(...)` uses `pg_net` plus a token stored in Supabase Vault only to forward one JSON request to the authenticated application route. It contains no lineup or lifecycle rules and is not exposed through the Data API.

Automatic completed-day archiving uses the same private transport discipline. The named pg_cron job calls `private.dispatch_daily_archive_rollover()` through pg_net/Vault; only the application decides Pacific eligibility, publication and immutable issuance. Runbook: `docs/operations/daily-archive-rollover.md`.

The opt-in Daily Nine leaderboard stores only a display name linked to an existing immutable completed-result submission ID. Its ranking read is scoped to exact puzzle/ruleset, permitted to the server service role only, and derives scores from existing validated completion summaries; browser and anonymous roles have no table or RPC privileges. See `docs/product/daily-nine-leaderboard.md`.

Custom Nine issued challenges are persisted append-only in `public.custom_nine_issued_challenges`. The record includes private canonical answer identities and all future hint values; RLS and revoked browser role grants are mandatory. Only service-role `SELECT` and `INSERT` are permitted, with no application `UPDATE` or `DELETE`. Hosted migration `20261009033237_create_custom_nine_issued_challenges` is applied; the **published GitHub migration file remains** `20261009032000_create_custom_nine_issued_challenges.sql`. These versions differ because the connected apply operation recorded its own hosted timestamp. Do not rename the already-published file: other databases may have recorded `20261009032000`. Before any Supabase CLI migration push or repair, inspect all relevant environments' migration histories and resolve discrepancies as a separately reviewed, environment-specific operation. Never replay this CREATE TABLE blindly. Post-merge verification: RLS on; anon/auth SELECT and INSERT denied; service-role SELECT/INSERT allowed; UPDATE/DELETE denied; zero rows. The remaining existing security-advisor warnings are not caused by this change. Creation/validation, signed hint delivery, and creator eligibility must remain outside SQL. See `tasks/plans/custom-nine-mvp.md`.

Custom Nine score storage is separate from Universal and Archive: `custom_nine_completed_results` and `custom_nine_at_bat_results`, each keyed by the permanent issued challenge ID and constrained to `points-v4`. Their own exact-challenge population indexes, RLS, and service-role-only SELECT/INSERT grants keep private results out of Daily comparison RPCs. **The tables alone do not authorize competitive submissions.** No app write/read adapters or creator exclusion are activated by this migration. Later server admission must reject creation-browser preview participation before inserting validated engine-normalized results; an anonymous different browser is not account-grade proof of non-creator status.

The Custom Nine result adapter is server-only and maps a fixed noncalendar session sentinel and internal puzzle number 1 into the existing portable Daily result types, without storing those fields in Custom tables. It rejects non-Custom IDs, non-v4 scores and incomplete games before calling Supabase. First-insert and atomic unique-conflict rereads use Custom tables only. Do not wire anonymous requests to this adapter without a separate authoritative engine-validation and creation-browser eligibility gate.
