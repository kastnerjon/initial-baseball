# Daily Nine comparison performance evidence — September 19, 2026

Status: representative isolated benchmark complete; **current raw-read architecture is sufficient for the beta-scale activation path**  
Scope plan: `tasks/plans/daily-nine-comparison-performance-evidence.md`

## Purpose

Record production-safe baseline evidence plus representative isolated evidence for the existing Daily Nine comparison read shapes before any activation or optimization decision.

This document is evidence for a storage/read-strategy decision. It is not a traffic-capacity guarantee and does not claim browser/provider/network latency that was not measured.

## Architecture conclusion

Retain:

- immutable raw resolved-AB rows as authoritative facts;
- immutable raw completed-game rows as authoritative facts;
- indexed/read-time aggregation through the existing server-only comparison RPCs;
- `DailyNineComparisonRepository` as the storage-strategy seam;
- separate AB and completed-game populations;
- default-off public comparison routes until a separate activation decision.

Do **not** add a transactional rollup, cache, materialized view, mutable counter, or new index based on the current evidence.

The reason is measured rather than philosophical: at a 10,000-result target population, the actual functions remain far inside the provisional database-latency budget. A rollup would add derived persisted state, write-path coupling, reconciliation work, and potential hot-row contention without solving a demonstrated bottleneck.

If scale later invalidates this result, a rebuildable rollup can replace the provider implementation without changing the comparison service/UI contract.

## User-perceived latency requirement

The own result and the comparison result are intentionally separate.

The browser should:

1. show the terminal baseball outcome and awarded points immediately;
2. launch comparison work asynchronously;
3. keep Next At Bat/completion/share independent of comparison;
4. fill the comparison value when the request returns.

For this architecture checkpoint:

- provisional database budget at a 10,000-result population: **25 ms p95**;
- later end-to-end comparison target after browser activation: roughly **500 ms p95** from terminal result to comparison render on an ordinary mobile path.

The end-to-end number is a product target to measure later, not a current production SLO. Database execution should consume only a small fraction of it.

## Production-safe baseline

Environment:

- hosted Supabase project `initial-baseball-db`;
- PostgreSQL 17.6, aarch64 at the time of the original baseline;
- comparison migration `20260919164818_create_daily_nine_comparison_reads`;
- comparison GET routes remain disabled in production.

Live population at the original measurement time:

- `public.daily_at_bat_results`: 10 rows;
- `public.daily_completed_results`: 5 rows;
- Daily #146 / points-v3 had 2 observations in pitch 1 and 1 in each other pitch;
- Daily #145 / points-v3 had 2 completed results.

The production tables have since continued receiving real result rows; these historical counts are retained only to describe the baseline measurement.

Current production-safe live plans at that tiny population selected the intended population indexes. Warmed execution was sub-millisecond:

- AB p50/p95: 0.129 / 0.157 ms;
- completed p50/p95: 0.177 / 0.211 ms.

Those tiny-population numbers were never treated as scale evidence.

## Isolated representative benchmark

### Harness

Committed reproducible harness:

- `.github/workflows/daily-nine-comparison-benchmark.yml`;
- `scripts/benchmark-daily-nine-comparison.sql`.

Successful evidence run:

- GitHub Actions workflow: **Daily Nine comparison benchmark**, run #5;
- run ID: `35479976826`;
- harness commit: `95f8af40bfa1cfa22225a377418b33e763d114ad`;
- PostgreSQL server: 17.11, x86_64 Debian image.

The workflow:

1. starts a disposable PostgreSQL 17 service;
2. creates the minimal `anon`, `authenticated`, and `service_role` roles required by the checked-in migrations;
3. applies the exact relevant completed-result, privilege-hardening, resolved-AB, and comparison migrations;
4. seeds deterministic target and unrelated populations;
5. runs `ANALYZE`;
6. exercises the actual comparison functions;
7. records direct query-body `EXPLAIN (ANALYZE, BUFFERS)`;
8. records 100 warmed timing samples per read shape;
9. uploads the full evidence artifact.

No synthetic row touches production.

### Data shape

For each target scale `N in {100, 1000, 10000}`:

Resolved AB:

- nine target slots receive `N` rows each;
- one unrelated puzzle receives the same shape;
- the measured comparison reads one exact target slot;
- stored awarded points span the current persisted `0..7` points-v3 range.

Completed game:

- the target puzzle receives `N` completed rows;
- one unrelated puzzle receives `N` completed rows;
- rows carry a realistic nine-at-bat JSON payload rather than an empty placeholder;
- target scores span all 64 current points-v3 score buckets.

The benchmark uses already-derived stored numbers only; it does not implement scoring logic.

## Results

### Warm function latency

| Target observations | Resolved AB p50 | Resolved AB p95 | Completed p50 | Completed p95 |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 0.076 ms | 0.093 ms | 0.116 ms | 0.129 ms |
| 1,000 | 0.241 ms | 0.266 ms | 0.560 ms | 0.627 ms |
| 10,000 | 1.710 ms | 1.807 ms | 5.783 ms | 6.254 ms |

Each row is based on 100 timed samples after a 10-call warm-up inside the disposable database.

The values measure database execution around the actual PostgreSQL functions. They exclude Supabase HTTP/PostgREST, Vercel, browser, and public-network latency.

### Direct query-body plans

At 10,000 target AB observations for one slot:

- `daily_at_bat_results_population_slot_idx` was selected through a bitmap index scan + bitmap heap scan;
- 10,000 matching rows were processed;
- 205 shared buffers were hit for the aggregate plan;
- instrumented direct-body execution: **2.105 ms**.

At 10,000 target completed games:

- the synthetic completed table contained 20,000 total rows because target and unrelated populations were intentionally equal;
- PostgreSQL chose a sequential scan because the requested target was 50% of the table, so an index path was not selective;
- 10,000 target rows were grouped into 64 buckets;
- 5,000 shared buffers were hit;
- hash aggregation produced 64 groups;
- final quicksort used **27 kB** memory;
- no temporary spill occurred;
- instrumented direct-body execution: **7.959 ms**.

This completed-game plan is useful evidence rather than a benchmark defect. With a deliberately low-selectivity 50/50 table, PostgreSQL preferred scanning 20,000 rows; even that path remained comfortably inside the database budget. The prior tiny production plan did use `daily_completed_results_population_idx`, showing that plan choice depends on selectivity and statistics as expected.

### Physical sizes

| Target scale | AB heap | AB indexes | AB total | Completed heap | Completed indexes | Completed total |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 212,992 B | 352,256 B | 598,016 B | 409,600 B | 32,768 B | 475,136 B |
| 1,000 | 2,113,536 B | 2,924,544 B | 5,070,848 B | 4,096,000 B | 212,992 B | 4,341,760 B |
| 10,000 | 21,069,824 B | 30,670,848 B | 51,773,440 B | 40,960,000 B | 1,908,736 B | 42,909,696 B |

For ABs the total table contains nine target slots plus nine unrelated slots, so the 10,000-scale case contains 180,000 AB rows. The completed table contains 20,000 rows at that scale.

## Interpretation

The current raw-read model is not constant-cost. Both aggregates still do work proportional to the qualifying population, and that fact should remain explicit.

However, the measured cost at the stated representative beta checkpoint is small:

- AB p95 at 10,000: **1.807 ms**;
- completed p95 at 10,000: **6.254 ms**;
- both are well below the provisional **25 ms database p95** design budget.

Therefore the evidence does not justify adding derived persisted state merely to make the read asymptotically constant.

The simpler current design also preserves desirable properties:

- one authoritative immutable fact store;
- no aggregate-drift failure mode;
- no synchronous mutable-counter update on result submission;
- no hot summary row;
- straightforward audit/rebuild;
- existing provider-neutral read interface already permits later replacement.

## What remains unmeasured

This benchmark does **not** establish:

- managed Supabase/PostgREST round-trip p50/p95 at 10,000;
- Vercel route latency;
- mobile/browser scheduling latency;
- exact production cold-cache behavior;
- arbitrary concurrency or traffic capacity;
- million-player-scale economics.

Those are separate questions.

A later bounded web observability checkpoint adds handler-level `Server-Timing` to both comparison GET routes. That timing includes route/server/provider work and is intended for decomposition against a real browser trace; it does not by itself establish the approximately 500 ms p95 trigger-to-visible target or isolate Supabase/PostgREST from the rest of handler execution. The first production sample after that seam, recorded in `docs/engineering/daily-nine-comparison-server-timing-2026-09-22.md`, retained 20 successful samples per route: AB median 65 ms / nearest-rank p95 582 ms / max 1,626 ms; completed median 58 ms / p95 430 ms / max 1,525 ms. These handler values do not overturn the isolated raw-read benchmark; instead they motivate stage-level decomposition of authoritative-puzzle loading versus managed provider work before any storage optimization.

Concurrent-read/mixed-insert testing is no longer treated as a prerequisite for choosing between raw reads and rollups at this beta checkpoint. The current write model is immutable insert-only and does not introduce the shared mutable counter that would itself create a hot-row concurrency concern. If production load later reveals contention or resource pressure, measure that concrete bottleneck then.

## Decision

**Keep raw reads now. Keep rollups reversible and deferred.**

The next bounded concern is an explicit comparison activation decision, followed by asynchronous browser/UI integration that preserves:

- immediate own-result rendering;
- comparison I/O off the gameplay critical path;
- stale-response fencing;
- independent AB/completed populations;
- failure-isolated comparison reads;
- real end-to-end latency measurement once a browser consumer exists.

If later database measurements exceed budget, the preferred fallback is a rebuildable transactional projection behind `DailyNineComparisonRepository`:

- AB projection: observation count + awarded-points sum;
- completed projection: sparse score/count buckets;
- partitioned by stable puzzle identity + `ruleset_version`;
- updated only for genuinely new immutable results;
- no scoring rules in SQL.

That fallback is deliberately not implemented now.

## Historical synthetic diagnostic

Before the isolated harness existed, a production-safe generated CTE diagnostic showed linear aggregate work but did not exercise the real indexes:

- AB target 100 / 1,000 / 10,000: 1.567 / 14.455 / 172.995 ms;
- completed target 100 / 1,000 / 10,000: 0.396 / 2.371 / 23.265 ms.

The 10,000 AB CTE spilled because it deliberately materialized and scanned generated rows without the real population index. The isolated benchmark supersedes that diagnostic for architecture decisions. It remains recorded to explain why synthetic non-indexed microbenchmarks must not be mistaken for real table/index behavior.
