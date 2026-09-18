# Daily Nine comparison aggregate contract

Status: Implemented scope contract  
Date: 2026-09-18

## Goal

Define the portable same-puzzle/`points-v3` comparison read contract and aggregation semantics without adding a database implementation, API, or UI.

## Owning layer

`packages/daily`.

The Daily layer owns comparison orchestration and population semantics. Existing points-v3 scoring remains engine-owned and is reused rather than copied.

## Architecture check

- Result write/idempotency contracts remain unchanged.
- The comparison repository is a read-only port separate from `DailyCompletedResultRepository.insertIfAbsent`.
- Providers return bounded sufficient statistics, not final scored comparison semantics.
- Score buckets use persisted engine-derived whole-game points.
- At-bat buckets contain only grouped normalized facts: slot, outcome, hints, wrong guesses, resolution, count.
- The portable aggregator calls engine `getDailyAtBatPoints` to derive per-at-bat points.
- No SQL scoring formula, raw-population transfer, React rule, cache service, or new package is introduced.

## In scope

- `DailyNineComparisonPopulationKey` scoped to exact puzzle identity + `points-v3`;
- provider-neutral score and at-bat fact bucket contracts;
- read-only `DailyNineComparisonRepository`;
- service + pure aggregation for completion count and average total points;
- score distribution;
- nine per-slot metrics: average points, average hints, hint-use rate, outcome rates, resolution rates;
- fail-closed slot sample-count invariant;
- focused tests and package exports;
- data-model/todo reconciliation.

## Out of scope

- Supabase function/view/RPC or migration;
- web API route;
- browser fetching/retry/caching;
- comparison UI;
- percentile/ranking/tie semantics;
- Classic aggregates;
- write-contract or result-table changes.

## Acceptance checks

- empty population returns a stable nine-slot zero shape;
- grouped facts produce engine-derived points-v3 averages;
- score distribution and rates are weighted correctly;
- every Daily Nine slot must have the same sample size as the completion population;
- service preserves exact puzzle/ruleset scoping through the read port;
- focused tests, full CI, documentation-impact, and preview pass.

## Stop conditions

Stop and split if this requires a schema change, provider-specific query code, API/UI work, a new cache, a result-write contract change, or a percentile product decision.
