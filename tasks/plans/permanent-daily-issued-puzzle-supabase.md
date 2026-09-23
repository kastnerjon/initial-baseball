# Permanent Daily issued-puzzle Supabase provider

Status: implemented provider boundary

## Scope contract

- **Goal:** implement the portable immutable issued-puzzle repository with append-only Supabase persistence.
- **Owning layer:** web persistence adapter + Supabase schema.
- **In scope:** one new table, service-role SELECT/INSERT-only privileges, server-only row codec and repository adapter, atomic insert-first/read-on-conflict behavior, provider tests, and canonical documentation.
- **Out of scope:** choosing the launch date, automatically issuing puzzles, archive reads/routes, browser history, UI, scoring, or Classic availability.
- **Acceptance checks:** exact snapshot round-trips; service role has no UPDATE/DELETE privilege; unique conflicts read the existing identity winner; malformed rows fail closed; no beta rows are imported.
- **Stop conditions:** issuance orchestration or public archive access becomes the next bounded PR.

## Storage

`public.permanent_daily_issued_puzzles` stores one row per `(series_version, daily_number)`.

The row contains permanent identity, schema version, stable puzzle ID, the exact ordered nine canonical player IDs, portable first-issue timestamp, and provider receipt time. Unique constraints also protect one date per series and one global puzzle ID.

RLS is enabled. Browser roles receive no privileges. `service_role` receives only `SELECT` and `INSERT`; the application has no update/upsert/delete path.

## Adapter behavior

The provider attempts one insert. On PostgreSQL unique-key conflict it reads the existing row by permanent identity and returns that row to the portable Daily service, which decides whether the retry is idempotent or an immutable conflict.

Malformed persisted rows, mismatched puzzle IDs, unsupported schema/series values, and unreadable conflict winners fail closed.

## Next boundary

Portable issuance orchestration is now implemented in `packages/daily` without configuring a launch epoch: the caller supplies an explicit permanent identity and a same-date scheduled/published editorial puzzle. The next bounded concern is server-only web composition with this Supabase repository while still requiring that explicit identity. Automatic date-driven issuance waits for the owner to choose the launch epoch/configuration policy. Public archive reads come after persisted issuance can be composed.
