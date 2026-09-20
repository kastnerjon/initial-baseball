# Daily Nine comparison performance evidence — September 19, 2026

Status: partial evidence; **not sufficient for production activation**  
Scope plan: `tasks/plans/daily-nine-comparison-performance-evidence.md`

## Purpose

Record what can be measured safely without inserting benchmark rows into the live result populations, and identify exactly what remains before the default-off comparison routes can be considered for activation.

This document is evidence, not a capacity claim and not an optimization proposal.

## Production-safe baseline

Environment:

- hosted Supabase project `initial-baseball-db`;
- PostgreSQL 17.6, aarch64;
- comparison migration `20260919164818_create_daily_nine_comparison_reads`;
- comparison GET routes remain disabled in production.

Live population at measurement time:

- `public.daily_at_bat_results`: 10 rows;
- `public.daily_completed_results`: 5 rows;
- Daily #146 / points-v3 had 2 observations in pitch 1 and 1 in each other pitch;
- Daily #145 / points-v3 had 2 completed results.

Current physical sizes at this tiny population:

| Relation | Heap bytes | Index bytes | Total bytes |
| --- | ---: | ---: | ---: |
| `daily_at_bat_results` | 8,192 | 32,768 | 49,152 |
| `daily_completed_results` | 16,384 | 32,768 | 81,920 |

These fixed-page-size numbers are baseline only and must not be extrapolated linearly from five or ten rows.

## Live query plans

### Resolved at-bat

The exact Daily #146 pitch-1 aggregate selected `daily_at_bat_results_population_slot_idx`.

Observed plan characteristics:

- index condition: puzzle ID + ruleset + pitch number;
- puzzle date/number remain residual filters;
- 2 actual matching rows;
- 5 shared hit blocks, 0 shared read blocks in the captured plan;
- first captured `EXPLAIN (ANALYZE, BUFFERS)` execution time: **0.241 ms**.

Twenty subsequent warmed observations of the same direct SQL shape:

- execution p50: **0.129 ms**;
- execution p95: **0.157 ms**;
- min/max: **0.119 / 0.166 ms**;
- planning p50/p95: **0.516 / 0.590 ms**.

### Completed-game histogram

The exact Daily #145 points-v3 aggregate selected `daily_completed_results_population_idx`, then sorted/grouped the persisted `summary.points` values.

Observed plan characteristics:

- index condition: puzzle date + ruleset + puzzle ID;
- puzzle number remains a residual filter;
- 2 actual matching rows producing 2 buckets;
- captured index-scan path had 2 shared hit blocks; the full aggregate/sort plan had 5 shared hit blocks;
- first captured `EXPLAIN (ANALYZE, BUFFERS)` execution time: **1.038 ms**.

Twenty subsequent warmed observations of the same direct SQL shape:

- execution p50: **0.177 ms**;
- execution p95: **0.211 ms**;
- min/max: **0.163 / 0.291 ms**;
- planning samples were roughly 0.49–0.61 ms after warm-up.

The first-run/warmed difference is reported as observed behavior only. Managed cache state was not controlled, so this is **not** labeled a true cold-cache benchmark.

## Provider round-trip shape

The current server adapter performs exactly one Supabase RPC per comparison read:

- one call to `daily_nine_at_bat_comparison` for one exact AB slot; or
- one call to `daily_nine_completed_score_buckets` for the independent completed-game population.

The route does not read both populations together. The server read service also loads the authoritative public puzzle before the provider call, but that puzzle path is separately cacheable and is not a second comparison-population RPC.

No production provider/network latency distribution was measured because the public comparison routes intentionally remain disabled.

## Synthetic SQL diagnostic

A production-safe CTE-only diagnostic used deterministic generated rows without touching either result table. It intentionally had **no population index**, so it measures generated-row/filter/aggregate CPU behavior, not the real indexed storage path.

Resolved-AB diagnostic generated nine target slots plus an equal number of unrelated-puzzle rows:

| Target observations per slot | Generated rows scanned/materialized | Matching rows | Execution |
| ---: | ---: | ---: | ---: |
| 100 | 1,800 | 100 | 1.567 ms |
| 1,000 | 18,000 | 1,000 | 14.455 ms |
| 10,000 | 180,000 | 10,000 | 172.995 ms |

At 10,000/slot the forced materialized CTE spilled to temporary storage (308 temp blocks read, 1,362 written). That spill is a property of this deliberately non-indexed diagnostic and must not be attributed to the real indexed query.

Completed-game diagnostic generated one target population plus an equal unrelated population:

| Target completed games | Generated rows | Matching rows | Execution |
| ---: | ---: | ---: | ---: |
| 100 | 200 | 100 | 0.396 ms |
| 1,000 | 2,000 | 1,000 | 2.371 ms |
| 10,000 | 20,000 | 10,000 | 23.265 ms |

Again, these numbers are not the current RPC's indexed p50/p95 and do not establish hosted capacity.

## What this evidence does establish

- The live functions currently choose the intended population indexes.
- The current provider preserves one independent RPC per requested population.
- Tiny-population execution is sub-millisecond once warm.
- No evidence collected so far justifies adding a cache, rollup, or new index.
- The non-indexed synthetic diagnostic is consistent with why the roadmap requires measuring the actual indexed path instead of assuming an index makes aggregate cost constant.

## What remains unproven

The activation gate must stay off until an isolated environment exercises the **real table/index/function shapes** with:

- 100 / 1,000 / 10,000 observations per AB slot;
- 100 / 1,000 / 10,000 completed games;
- unrelated puzzle rows;
- exact `EXPLAIN ANALYZE / BUFFERS` at those scales;
- relation/index bytes at scale;
- repeated p50/p95;
- concurrent reads;
- mixed insert/read load;
- provider/network round-trip latency if the isolated environment exposes the Supabase API.

The current production database is not an acceptable place to seed these synthetic populations, even with later cleanup.

## Current conclusion

**Evidence is insufficient for activation, and there is also no measured basis yet for an optimization PR.**

The next required measurement environment is an isolated PostgreSQL/Supabase database with the repository migrations applied. No existing Supabase development branch is available. Creating a new hosted branch may have account-specific cost and therefore requires explicit user cost confirmation before it can be used.

Until that environment exists, preserve:

- `DAILY_NINE_COMPARISON_READS_ENABLED` unset/false;
- current indexes and aggregate RPCs unchanged;
- no shared cache/rollup/index speculation;
- browser/UI work downstream of the activation/performance checkpoint.
