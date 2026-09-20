# Daily Nine comparison read performance evidence

Status: in progress on PR #203; production-safe baseline captured, representative isolated indexed benchmark still required  
Date: 2026-09-19

## Scope contract

- **Goal:** produce reproducible evidence for the existing Daily Nine comparison read shapes before any production activation, cache, rollup, or index change.
- **Owning concern:** measurement and benchmark evidence for the existing Postgres/Supabase comparison reads.
- **In scope:** a disposable benchmark harness; 100 / 1,000 / 10,000 exact-population observations; unrelated-puzzle/selectivity pressure; resolved-AB and completed-game reads independently; EXPLAIN ANALYZE / BUFFERS; warm/cold-or-best-available cache-state observations; repeated latency samples with p50/p95; mixed insert/read and concurrent-read evidence where the isolated environment supports it; relation/index-size evidence; provider round-trip accounting; production-safe tiny-population baselines; canonical documentation of methodology, limitations, raw evidence, and conclusions.
- **Out of scope:** enabling `DAILY_NINE_COMPARISON_READS_ENABLED`; React/browser fetching; UI; retry policy; result-write behavior; scoring; Classic comparison; production result seeding; production schema/index changes; cache/rollup implementation; choosing a paid hosting tier; claiming traffic capacity not directly supported by evidence.
- **Acceptance checks:** no benchmark row is committed to a production population; benchmark data is deterministic and disposable; both existing RPC query shapes are exercised without rewriting their semantics; measurements distinguish database execution from application/network overhead when possible; sample sizes and concurrency are recorded rather than implied; query plans and buffer behavior are captured; any inability to reproduce hosted index/mixed-load behavior is called out explicitly and blocks activation rather than being hand-waved away; full repository CI remains green.
- **Stop conditions:** any proposed index, rollup, materialized view, shared cache, TTL, CDN policy, deployment activation, or product/UI change moves to a separate PR after evidence is reviewed.

## Questions this PR must answer

1. How does one exact resolved-AB slot aggregate behave at 100, 1,000, and 10,000 observations when other slots and unrelated puzzles also exist?
2. How does one exact completed-game score-bucket aggregate behave at the same population sizes with unrelated rows?
3. Do the existing population indexes remain the selected plans, and how many heap/index pages are touched?
4. What are repeated warm-path p50/p95 database latencies for each scale?
5. What can be established about colder-cache behavior in the available isolated environment without pretending to control managed-host cache state?
6. Under mixed inserts/reads and concurrent reads, does latency or locking behavior change materially?
7. How many database/provider round trips does each comparison read require today?
8. What are the row/index byte costs of the current shapes at each scale?
9. Is the evidence sufficient to proceed to a separate activation decision without a cache/rollup/index change? This PR records evidence; it does not itself activate or redesign.

## Benchmark data shape

### Resolved at-bat

For each target scale `N in {100, 1000, 10000}`:

- nine exact slots for one benchmark puzzle receive `N` rows each;
- awarded points are deterministic integers in `0..7`;
- additional unrelated benchmark puzzles are populated so the target query is not the only data in the index;
- identity fields satisfy the real table constraints;
- the measured query filters exact puzzle ID/date/number, `points-v3`, and one pitch number.

This intentionally exercises the current covering population index plus its residual date/number checks.

### Completed game

For each target scale `N in {100, 1000, 10000}`:

- one benchmark puzzle receives `N` completed rows;
- points are deterministic integers in `0..63`;
- unrelated benchmark puzzles are populated as selectivity pressure;
- the measured query filters exact puzzle ID/date/number and `points-v3`, then groups the stored engine-derived summary points into buckets.

The benchmark does not reimplement or reinterpret scoring; it only supplies already-derived synthetic point values to exercise the aggregate read shape.

## Environment and safety

Preferred evidence order:

1. an isolated disposable Postgres/Supabase database with the repository migrations applied;
2. if no isolated database is available without a new paid resource, production-safe read-only plan/baseline evidence plus synthetic non-table SQL microbenchmarks may be recorded, but that evidence is **not** sufficient to declare the feature activation-ready;
3. never insert synthetic rows into `public.daily_at_bat_results` or `public.daily_completed_results` in production, even for cleanup afterward.

Creating a paid Supabase branch/project requires a separate explicit cost confirmation and is not silently done by this PR.

## Measurement protocol

For each query and scale, record:

- exact environment and PostgreSQL version when available;
- row counts for target and unrelated populations;
- `EXPLAIN (ANALYZE, BUFFERS)` plan;
- repeated execution samples after a short warm-up, with sample count stated;
- p50 and p95 latency from the measured layer;
- relevant buffer hits/reads and rows scanned;
- table and index bytes after data load;
- one-RPC-per-read provider call shape, plus any separately measured web/provider overhead;
- concurrent-read and mixed insert/read configuration, if the environment supports safe isolated concurrency.

"Cold" is used only when cache state can actually be controlled or observed. Otherwise report first-run versus warmed-run evidence with that limitation.

## Decision boundary

This PR may conclude one of three things:

- **Evidence supports a later activation review with current storage/read shapes.**
- **Evidence supports a separate optimization PR** (index/cache/rollup), with the measured bottleneck named.
- **Evidence is insufficient** because a representative isolated environment was unavailable; activation remains blocked.

It must not translate a tiny live population or synthetic CTE timing into an unsupported 10,000-play capacity claim.

## Documentation impact

Update `docs/START-HERE.md`, `docs/architecture-and-scale-plan.md`, `tasks/todo.md`, and `tasks/plans/resolved-at-bat-comparison.md` with the measured result and next bounded concern before merge. Keep this plan as the reproducible evidence record.
