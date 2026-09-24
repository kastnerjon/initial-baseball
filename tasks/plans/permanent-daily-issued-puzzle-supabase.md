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

The write provider attempts one insert. On PostgreSQL unique-key conflict it reads the existing row by permanent identity and returns that row to the portable Daily service, which decides whether the retry is idempotent or an immutable conflict.

A separate read factory in the same server-only adapter implements the portable read-only port. It performs zero-or-one-row lookup by `(series_version, daily_number)` or `(series_version, puzzle_date)`, both already unique in the immutable table, and decodes through the same strict row codec. It never inserts, updates, upserts, or deletes.

Malformed persisted rows, mismatched puzzle IDs, unsupported schema/series values, unreadable conflict winners, and provider query failures fail closed.

## Composition checkpoint

Portable issuance orchestration and server-only web composition are now layered over this provider. The web composition constructs both the authoritative editorial repository and this immutable issued-puzzle repository from one service-role Supabase client, reads the editorial row by the explicitly supplied permanent identity date, and delegates to the portable issuance service. It does not configure or infer a launch epoch and does not add update/delete behavior.

## Read checkpoint

The provider-neutral read port is implemented in this adapter without schema or privilege changes. Scope: `tasks/plans/permanent-daily-issued-puzzle-supabase-read.md`.

## Next boundary

Compose the portable read service server-side for later archive gameplay/materialization. Automatic date-driven issuance still waits for the owner to choose the launch epoch/configuration policy.
