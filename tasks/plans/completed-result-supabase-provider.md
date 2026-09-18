# Completed-result Supabase provider

Status: Active scope contract  
Date: 2026-09-17

## Goal

Make the already-merged portable completed-result repository/service usable with the current Supabase provider, while reconciling the already-applied production table into source control and enforcing least-privilege table access.

## Owning layer

Web persistence adapter / Supabase provider.

## Architecture check

- Engine remains the sole completed-result validation and summary-derivation authority.
- `packages/daily` remains the sole provider-neutral idempotency/service authority.
- This PR only maps normalized `DailyCompletedResult` values to/from Supabase rows and implements the existing atomic `insertIfAbsent` port.
- Supabase does not learn scoring, completion, puzzle validation, or comparison semantics.
- No React, HTTP route, browser storage, or submission lifecycle belongs here.

## In scope

- add the exact already-applied `20260917132147_create_daily_completed_results` migration to source control;
- add a separate privilege-hardening migration that revokes Supabase default table privileges from `service_role` and grants only `SELECT, INSERT`;
- preserve RLS enabled with no `anon`/`authenticated` policies;
- add a server-only row codec for schema-1 `points-v3` and `classic-inning-v1` normalized results;
- add the Supabase `DailyCompletedResultRepository` adapter using insert-first, unique-conflict read, and no update/upsert path;
- fail closed on malformed persisted rows/provider invariants;
- focused tests for points and Classic round-trip, atomic conflict behavior, malformed rows, and provider failures;
- reconcile data-model, architecture, handoff, and todo documentation.

## Out of scope

- public completed-result API;
- loading authoritative puzzles;
- calling `validateDailyCompletedResult`;
- browser submission IDs, retries, reset handling, or hooks;
- comparison reads, aggregates, percentiles, or UI;
- archive/history/accounts;
- legacy result migration;
- modifying or merging draft PR #161 wholesale.

## Acceptance checks

- production migration history and repository migration file agree for the existing results table;
- `service_role` has only direct `SELECT` and `INSERT` privileges on `daily_completed_results`;
- RLS remains enabled and there are no public result-table policies;
- provider inserts the complete normalized result and never updates/upserts;
- duplicate submission ID returns the existing winner for 4B to compare;
- malformed stored rows fail closed;
- focused tests, typecheck, full CI, documentation-impact, and preview pass;
- Supabase security/performance advisors show no new issue attributable to this change;
- final diff remains provider-only.

## Stop conditions

Stop and split work if implementation requires gameplay validation, HTTP/browser behavior, a new persistence primitive, a schema redesign, or any change to the 4A/4B portable contracts.
