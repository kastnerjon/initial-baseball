# Permanent Daily issued-puzzle Supabase reads

Status: implemented server provider read boundary

## Scope contract

- **Goal:** implement the portable permanent-puzzle read port against the existing immutable Supabase table.
- **Owning layer:** `apps/web` server-only Supabase adapter.
- **In scope:** read by permanent series + Daily number, read by permanent series + puzzle date, zero-or-one-row semantics, reuse of the established strict row decoder and query-error type, focused provider tests, and canonical documentation.
- **Out of scope:** schema/migration changes, privilege changes, inserts beyond the existing issuance repository, updates/upserts/deletes, server read composition, public archive routes, launch-date configuration, gameplay materialization, or browser history.
- **Acceptance checks:** number/date queries use the persisted unique keys; found rows decode to the portable immutable puzzle contract; missing rows return null; provider/query failures keep the established typed error boundary; existing write/conflict behavior remains unchanged.
- **Stop conditions:** any database DDL, new privilege, route/API contract, launch policy, or archive gameplay behavior becomes a separate PR.

## Provider behavior

`createSupabasePermanentDailyIssuedPuzzleReadRepository` lives beside the existing first-write-wins provider because both use the same table and row codec, while still implementing the separate portable read interface.

Both methods use the server-only Supabase client:

- `getByNumber` matches `series_version` + `daily_number`;
- `getByDate` matches `series_version` + `puzzle_date`.

Each query selects only the established immutable puzzle columns and uses zero-or-one-row semantics. A missing row is `null`. A returned row is decoded through `decodePermanentDailyIssuedPuzzleRow`, so malformed persisted data still fails closed.

The existing unique-conflict recovery path is refactored to share the same internal read helper; its external first-write-wins behavior is unchanged.

## Storage impact

None. The table already has:

- primary key `(series_version, daily_number)`;
- unique constraint `(series_version, puzzle_date)`;
- RLS enabled;
- `service_role` table privileges limited to `SELECT` + `INSERT`.

This PR adds no migration and inserts no archive data.

## Next boundary

Server-only composition with the portable read service is implemented in `tasks/plans/permanent-daily-issued-puzzle-read-composition.md`. Archive gameplay materialization now supports v1 reads and consumes v2 clue snapshots; scope: `tasks/plans/permanent-daily-archive-clue-materialization.md`. Keep public route/navigation and the launch-epoch decision separate.
