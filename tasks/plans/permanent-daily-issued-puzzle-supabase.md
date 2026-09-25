# Permanent Daily issued-puzzle Supabase provider

Status: implemented append-only v1/v2 provider boundary

## Scope contract

- **Goal:** implement the portable immutable issued-puzzle repository with append-only Supabase persistence, including the later clue-frozen schema-v2 envelope.
- **Owning layer:** web persistence adapter + Supabase schema.
- **In scope:** immutable table/storage constraints, service-role SELECT/INSERT-only privileges, server-only row codec and repository adapter, atomic insert-first/read-on-conflict behavior, v1/v2 provider reads, provider tests, and canonical documentation.
- **Out of scope:** choosing the launch date, automatically issuing puzzles, archive routes, browser history, UI, scoring, or Classic availability.
- **Acceptance checks:** v1 and v2 records round-trip; v1 stays backward-readable; service role has no UPDATE/DELETE privilege; unique conflicts read the existing identity winner; malformed rows fail closed; no beta or fake permanent rows are imported.
- **Stop conditions:** issuance orchestration changes or frozen-clue materialization are separate bounded PRs.

## Storage

`public.permanent_daily_issued_puzzles` stores one immutable row per `(series_version, daily_number)`.

Common columns contain permanent identity, schema version, stable puzzle ID, the exact ordered nine canonical player IDs, portable first-issue timestamp, and provider receipt time. Unique constraints also protect one date per series and one global puzzle ID.

Schema v2 adds nullable `clue_snapshot` JSONB. Schema v1 requires it to be null; schema v2 requires the clue-snapshot envelope. The strict application codec reconstructs the portable domain object and re-runs detailed clue validation, including exact four-slot/nine-pitch structure and canonical-player order alignment.

RLS is enabled. Browser roles receive no privileges. `service_role` receives only `SELECT` and `INSERT`; the application has no update/upsert/delete path.

## Adapter behavior

The write provider attempts one insert for either supported record version. On PostgreSQL unique-key conflict it reads the existing row by permanent identity and returns that first-write winner; it never overwrites it.

The read provider performs zero-or-one-row lookup by `(series_version, daily_number)` or `(series_version, puzzle_date)`, both already unique in the immutable table, and decodes through the same strict v1/v2 row codec.

Malformed persisted rows, mismatched puzzle IDs, unsupported schema/series values, missing or malformed v2 clue snapshots, clue/player-order drift, unreadable conflict winners, and provider query failures fail closed.

## Compatibility checkpoint

Current editorial issuance still creates schema-v1 records. The provider can persist schema v2, but the existing portable archive read service intentionally rejects v2 until the separate frozen-clue materialization work is complete. This prevents a v2 record from being rendered with mutable current hint generation during the transition.

Detailed v2 persistence scope: `tasks/plans/permanent-daily-issued-puzzle-v2-supabase.md`.

## Next boundary

Wire issuance to create/store schema-v2 records from the exact authorized public clue bundle. Archive materialization should consume the stored clue snapshot only in its following bounded PR.
