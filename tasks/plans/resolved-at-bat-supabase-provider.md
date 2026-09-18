# Resolved-at-bat Supabase provider

Status: Implemented and hosted; collection inactive
Date: 2026-09-18

## Goal

Make the merged portable resolved-AB repository/service usable through one server-only Supabase adapter and an immutable hosted table, without activating browser collection or comparison reads.

## Owning layer

Web persistence adapter / Supabase provider.

## Architecture check

- Engine remains the only validation and awarded-points authority.
- `packages/daily` remains the provider-neutral first-write-wins/idempotency authority.
- This PR only maps an already normalized `DailyAtBatResult` to/from one Supabase row and implements the existing `insertIfAbsent` port.
- SQL enforces transport shape, immutable observation identity and least privilege; it does not reproduce outcome consistency or scoring formulas.
- No React, HTTP route, browser identity/outbox, comparison query, or gameplay transition belongs here.

## In scope

- create `public.daily_at_bat_results` through a Supabase-generated migration;
- use `(attempt_id, puzzle_id, ruleset_version, pitch_number)` as the immutable composite primary key;
- add a separate `(puzzle_id, ruleset_version, pitch_number)` population index including `awarded_points` for the later exact count/average read;
- store normalized envelope fields, terminal AB facts, engine-derived points and provider receipt time only;
- enable RLS, grant no `anon`/`authenticated` table access, and grant `service_role` only `SELECT, INSERT`;
- add a server-only schema-1 row codec and Supabase repository adapter using insert-first, unique-conflict read, and no update/upsert path;
- fail closed on malformed persisted rows, wrong provider keys and unreadable unique-conflict winners;
- focused codec/repository tests for complete-field round-trip, composite-key lookup, provider errors and malformed rows;
- verify migration shape, privileges, RLS, atomic concurrent first-write-wins behavior and advisor delta on isolated data before activation;
- reconcile architecture, data-model, START-HERE and todo documentation.

## Out of scope

- authoritative puzzle lookup or `validateDailyAtBatResult` composition;
- public submission or read API;
- browser attempt ownership, cross-tab locking, immutable outbox, reset or legacy-save behavior;
- comparison aggregates, caching, freshness, performance claims or UI;
- completed-result refactoring, Classic AB collection, accounts/history, triggers, rollups, cron or realtime;
- production browser activation or synthetic rows in real puzzle populations.

## Acceptance checks

- the repository migration and hosted migration history agree;
- only `service_role` has direct `SELECT, INSERT` on `daily_at_bat_results`; RLS is enabled with no public policy;
- the provider writes every normalized field once and has no update/upsert path;
- identical concurrent inserts yield one stored row and one existing winner; differing same-key inserts preserve the first row for the Daily service to classify;
- puzzle/ruleset/slot population lookup has the intended index and no uniqueness dimension can double-count one observation;
- malformed stored rows and non-unique provider failures fail closed;
- Supabase security/performance advisors introduce no unexpected finding attributable to this change;
- focused tests, full tests, typecheck, lint, build, file-size, documentation-impact and preview checks pass;
- final diff remains one provider concern and below repository decomposition limits.

## Stop conditions

Stop and split work if implementation requires changing portable contracts, adding gameplay/scoring logic to SQL, designing the comparison API/query, adding a server session table, or activating browser collection.

## Verification record

- Hosted migration history and source use `20260918185110_create_daily_at_bat_results`.
- Hosted table inspection confirmed the exact composite primary key and separate covering population index.
- RLS is enabled with zero policies. `anon` and `authenticated` have no `SELECT`/`INSERT`; `service_role` has `SELECT`/`INSERT` and no `UPDATE`/`DELETE`.
- Two simultaneous disposable same-key inserts with different normalized payloads produced exactly one winner. The verification row was deleted and row count returned to zero.
- Security advisors added only the expected informational no-policy notice for the intentionally server-only table. Performance advisors added only the expected unused-index notice while collection remains inactive. Pre-existing unrelated warnings were unchanged.
