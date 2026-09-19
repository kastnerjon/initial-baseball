# Daily Nine Supabase comparison provider

Status: implemented on PR #198; hosted migration/readback and merge verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** implement the server-only Supabase adapter that satisfies the portable Daily Nine comparison read repository with aggregate-only database reads.
- **Owning layer:** `apps/web` Supabase adapter boundary, with one supporting Supabase migration.
- **In scope:** two read-only SQL RPCs for resolved-AB count/point-sum and completed score buckets; service-role-only execute privileges; `SECURITY INVOKER`; server-only repository adapter; strict provider-row decoding; focused tests; hosted schema/privilege/function verification; current query-plan evidence; canonical documentation.
- **Out of scope:** public/read-only HTTP API, browser fetching/retry/freshness/cache, React/UI, sample-size thresholds, R5/R6/R8, rollups/materialized views/triggers/cron, new aggregate indexes, result writes, scoring changes, representative 100/1k/10k load benchmarking.
- **Acceptance checks:** no raw result rows leave Postgres; at-bat read returns exactly one count/sum row and maps empty to zero/zero; completed read returns score/count buckets only; provider/query failures and malformed rows fail closed; functions are not executable by PUBLIC/anon/authenticated and are executable by service_role; existing AB covering index and completed population index support the query shapes; full CI passes; hosted migration and readback are reconciled.
- **Stop conditions:** any need for a cache/rollup/index redesign, API surface, browser behavior, write-path change, scoring recomputation, or client-visible database grant becomes a separate PR.

## Architecture decisions

### One RPC per independent population

The portable repository already separates one resolved-at-bat slot read from completed-game distribution reads. The Supabase adapter preserves that boundary: no call fetches both populations and no AB reveal pays for the completed-game query.

### Aggregate in Postgres, never in Node

The AB function returns only `count(*)` and `sum(awarded_points)`. The completed function returns only `points/count` buckets from the stored engine-derived points summary. The web process never downloads anonymous attempt/submission rows to aggregate them.

### Security invoker and least privilege

Both functions are `SECURITY INVOKER` and schema-qualified with an empty search path. Execution is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to `service_role`. The service role already has SELECT on the underlying immutable result tables; no browser role receives table or function access.

### Use the existing indexes

The AB query uses `daily_at_bat_results_population_slot_idx` to narrow by puzzle/ruleset/slot, then checks exact date/number metadata as a residual filter. Hosted EXPLAIN shows an Index Scan with those residual checks. The completed query uses `daily_completed_results_population_idx` for date/ruleset/puzzle and checks puzzle number residually; hosted EXPLAIN shows the population index feeding the grouped score-bucket read. This favors exact-key correctness over widening indexes before measurement. No new index is added before representative mixed-load evidence demonstrates a need.

### Fail closed on malformed persisted aggregate data

The SQL does not copy scoring rules. It casts the persisted points-v3 summary value to an integer bucket; malformed persisted points cause a query/provider failure rather than being silently omitted. The adapter separately validates RPC response cardinality, non-negative safe counts/sums, and integer bucket shapes before the portable Daily service applies its 0–63 and points-v3 semantic validation.
