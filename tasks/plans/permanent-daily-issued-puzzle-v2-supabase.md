# Permanent Daily schema-v2 Supabase persistence

Status: implemented provider-persistence boundary.

## Scope contract

- **Goal:** persist and strictly round-trip the existing schema-v2 clue-frozen permanent Daily record without changing issuance or archive materialization.
- **Owning layer:** Supabase schema plus the server-only web persistence adapter, with only the minimal portable repository/read-port widening needed to represent the already-defined v1/v2 record union truthfully.
- **In scope:** additive nullable `clue_snapshot` JSONB storage, schema-version 1/2 constraints, v1/v2 row codec support, append-only repository/read-provider support, v1 backward compatibility, fail-closed malformed-v2 decoding, focused tests, hosted privilege/RLS verification, and canonical documentation.
- **Out of scope:** creating v2 records from editorial issuance, consuming frozen clues in archive materialization, launch epoch configuration, permanent row creation, initials changes, scoring changes, browser routes/navigation, or public database reads.
- **Acceptance checks:** v1 remains readable with no clue snapshot; v2 round-trips exact clue content; v2 requires a valid clue snapshot aligned to the frozen canonical order; unique-key conflicts keep the first row; no update/upsert/delete path exists; service-role remains SELECT/INSERT-only; anon/authenticated retain no table privilege; hosted row count remains zero.
- **Stop conditions:** if persistence requires rewriting existing rows, changing browser/database authority, or wiring issuance/materialization, split that work into the next PR.

## Storage contract

`public.permanent_daily_issued_puzzles.clue_snapshot` is nullable JSONB.

- Schema v1 requires `clue_snapshot IS NULL`.
- Schema v2 requires a JSON object with clue-snapshot schema version 1 plus array-shaped `hintLayout` and `pitches`.
- Detailed four-hint/nine-pitch ordering, supported hint types, nonempty strings, and clue-player/order alignment remain domain validation in `packages/daily` and the strict row codec. The database constraint protects the version/presence envelope without duplicating the full portable schema in SQL.

The migration does not grant new privileges or add policies. Existing RLS plus service-role SELECT/INSERT-only access remains the security boundary.

## Compatibility boundary

The provider repository/read port stores and decodes both v1 and v2 records. The archive read service and materializer now pass v2 clues through from persistence without rebuilding them from mutable player data, while retaining the v1 path. This avoids silently changing already-issued public clues.

## Portable issuance checkpoint

The schema-v2 first-write-wins service and portable clue-frozen issuance orchestration are now implemented in `packages/daily`. They accept an already-materialized clue snapshot, preserve exact-retry idempotency, and reject clue changes or v1/v2 collisions as immutable conflicts. Scope: `tasks/plans/permanent-daily-clue-frozen-issuance.md`.

## Next bounded PR

The server-only issuance composition writes schema-v2 records after materializing clues through the existing canonical player and Daily hint adapters. Scope: `tasks/plans/permanent-daily-server-clue-issuance.md`. Archive materialization now consumes those stored v2 clues; see `tasks/plans/permanent-daily-archive-clue-materialization.md`.
