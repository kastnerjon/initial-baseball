# Daily Nine comparison read performance evidence

Status: representative isolated indexed benchmark complete on PR #203; current raw-read architecture retained  
Date: 2026-09-19

## Scope contract

- **Goal:** produce reproducible evidence for the existing Daily Nine comparison read shapes before any production activation, cache, rollup, or index change.
- **Owning concern:** measurement and architecture evidence for the existing Postgres/Supabase comparison reads.
- **In scope:** production-safe live baseline; disposable PostgreSQL 17 benchmark harness; 100 / 1,000 / 10,000 exact-population observations; unrelated-puzzle pressure; resolved-AB and completed-game reads independently; actual repository migrations/functions; direct query-body EXPLAIN ANALYZE / BUFFERS; repeated warm-path p50/p95; relation/index bytes; provider round-trip accounting; explicit latency budget; canonical documentation.
- **Out of scope:** enabling `DAILY_NINE_COMPARISON_READS_ENABLED`; React/browser fetching; UI; result-write behavior; scoring; Classic comparison; production result seeding; production schema/index changes; cache/rollup implementation; paid infrastructure; unsupported capacity claims.
- **Acceptance checks:** no benchmark row enters production; benchmark data is deterministic/disposable; actual relevant migrations/functions execute; both read shapes are measured at 100 / 1,000 / 10,000; underlying plans and buffers are visible; repeated p50/p95 are recorded; limitations distinguish isolated DB execution from managed/provider/network latency; full repository CI remains green.
- **Stop conditions:** any index, cache, rollup, materialized view, write-path, deployment-activation, browser, UI, or product change moves to a separate PR after evidence review.

## Settled decision after architecture review

Keep the current immutable raw-result + indexed read-time aggregation architecture for beta. Do not add transactional rollups, mutable counters, cache infrastructure, or a new index before measured evidence requires them.

The existing `DailyNineComparisonRepository` is the reversibility seam:

- callers ask for factual sufficient statistics, not a storage strategy;
- today the Supabase adapter obtains them from raw aggregate RPCs;
- a future adapter may read projection/rollup rows without changing browser/UI/domain contracts;
- raw immutable rows remain authoritative either way.

This intentionally optimizes for simple correctness now while keeping a future storage change contained to the persistence/provider layer.

## Product latency budget

Gameplay result presentation and comparison are separate:

1. show the user's terminal baseball result and awarded points immediately;
2. start comparison work asynchronously;
3. never block Next At Bat, completion, or sharing on comparison;
4. fill YOU / AVG or final comparison when the read returns.

For the storage decision, use a provisional **25 ms database p95 budget at a 10,000-result population**. That leaves most of a later end-to-end target of roughly **500 ms p95** for browser/server/network/provider overhead. These are design budgets, not hard CI thresholds or production SLO claims.

If real browser/server timing later misses the end-to-end target while database execution remains well inside 25 ms, optimize the network/composition path rather than introducing rollups.

## Benchmark environment

Committed harness:

- `.github/workflows/daily-nine-comparison-benchmark.yml`
- `scripts/benchmark-daily-nine-comparison.sql`

The workflow starts a disposable PostgreSQL 17 service, creates the minimal Supabase roles required by the checked-in migrations, applies the exact relevant result/comparison migrations, seeds deterministic target and unrelated populations, runs the actual comparison functions, exposes the function-body plans, records relation sizes, and executes 100 warmed timing samples per shape.

The successful evidence run was GitHub Actions run #5 / run ID `35479976826` on harness SHA `95f8af40bfa1cfa22225a377418b33e763d114ad`, PostgreSQL 17.11 x86_64.

This is not a Supabase cloud/network benchmark and is not treated as one.

## Representative results

Warm database execution p95 from the actual functions:

| Target population | Resolved AB p95 | Completed p95 |
| ---: | ---: | ---: |
| 100 | 0.093 ms | 0.129 ms |
| 1,000 | 0.266 ms | 0.627 ms |
| 10,000 | 1.807 ms | 6.254 ms |

At 10,000:

- the resolved-AB query body used `daily_at_bat_results_population_slot_idx` via a bitmap index/heap path and returned the exact 10,000-row slot population;
- the completed query body chose a sequential scan because the deliberately balanced synthetic table made the target puzzle 50% of rows; even that conservative shape scanned 20,000 completed rows, grouped 10,000 target rows into 64 buckets, used a 27 kB in-memory quicksort, and completed the instrumented body plan in 7.959 ms;
- no temporary spill occurred;
- both shapes stayed comfortably inside the 25 ms database budget.

## What this establishes

- There is no measured reason to add a rollup/cache/index before beta activation.
- The current read cost still grows with population; this benchmark does not make it constant-cost.
- The repository boundary should remain storage-strategy-neutral so a future rollup is a provider/persistence change rather than a UI rewrite.
- The result does not establish managed Supabase network latency, browser latency, arbitrary traffic capacity, or million-player scale.

## Deferred evidence

Concurrent-read/mixed-insert testing is not a pre-activation storage blocker after the representative single-read result. The current raw architecture uses immutable inserts plus read-only aggregates rather than shared mutable counter rows, so the main newly measured storage concern was population-scan latency. If production telemetry or traffic materially changes that assumption, reopen concurrency/load evidence as a bounded performance concern.

Provider/network and browser-perceived latency must be measured when the comparison client is activated. The own-result path remains immediate regardless.

## Decision boundary from here

PR #203 should conclude:

**Evidence supports a later activation review with the current raw storage/read shapes. No optimization PR is justified now.**

If later measurements miss the budget:

1. identify whether database, server composition, provider/network, or browser scheduling is actually dominant;
2. optimize the measured bottleneck only;
3. if database aggregation is the bottleneck, prefer a rebuildable transactional projection behind `DailyNineComparisonRepository` using count + point sum for ABs and sparse score/count buckets for completed games;
4. keep scoring engine-owned and partition incompatible populations by `ruleset_version`.

## Documentation impact

Before merge, reconcile `docs/START-HERE.md`, `docs/architecture-and-scale-plan.md`, `tasks/todo.md`, and `tasks/plans/resolved-at-bat-comparison.md` to the measured raw-read decision and the next bounded activation concern.
