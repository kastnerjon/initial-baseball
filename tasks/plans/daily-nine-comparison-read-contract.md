# Daily Nine portable comparison read contract

Status: implemented on this PR; merge verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** define the smallest provider-neutral read contract that can power Daily Nine YOU / AVG after a terminal at-bat and whole-game comparison at completion without mixing populations or moving scoring into SQL/UI.
- **Owning layer:** `packages/daily`.
- **In scope:** exact puzzle + `points-v3` comparison identity; one-slot resolved-AB count/point-sum read; separate completed-game score-bucket read; null empty averages; bounded 0–63 histogram; strict-lower finish rate; runtime validation; focused tests; package exports and canonical docs.
- **Out of scope:** Supabase queries/functions/migrations, API routes, browser fetching/retry/cache/freshness, React/UI, sample-size presentation thresholds, R5/R6/R8, Classic comparison, result writes, scoring changes, rollups, performance claims.
- **Acceptance checks:** partial-game slot counts may differ freely; no completed-game read occurs for an at-bat request; empty averages are null; malformed sufficient statistics fail closed; score buckets normalize deterministically; ties are not counted as beaten; focused/full CI and preview pass.
- **Stop conditions:** provider-specific query code, new database objects, API/React work, external dependencies, or a need to alter result-write/scoring contracts becomes a separate PR. The existing allowed Daily → engine dependency is used only for the canonical points-v3 maximum constant.

## First-principles decisions

### Independent reads, not one aggregate blob

The live product asks for one slot comparison after each terminal AB but needs the completed-game distribution only at completion. Those are different tables/populations and have different cost profiles. The repository therefore exposes two concrete methods instead of forcing every AB reveal to read the completion population.

### Persisted points are already authoritative enough for aggregation

`daily_at_bat_results.awarded_points` is engine-derived at write time. The provider returns only the received row count and sum for one slot. Daily divides them; it does not re-run scoring and SQL does not copy the formula. Bounds use the engine-exported `POINTS_V3_MAX_POINTS_PER_AT_BAT` constant rather than duplicating a scoring number.

### Completed scores are buckets

The completed provider returns score/count buckets. Daily normalizes them into a 64-entry 0–63 histogram, derives count/average, and owns the settled strict-lower tie rule. Duplicate provider buckets are safely combined.

### Empty is not zero

No observations means no average, so `averagePoints` is null. Zero remains a real observed score.

### Freshness belongs to the web read contract

This portable layer has no clock or cache policy. The later read-only API/cache concern must make freshness explicit and distinguish cached/unavailable reads without changing these population semantics.

## Prior drafts

PR #174 is closed as superseded. Its read-port separation was directionally useful, but its equal-population invariant, extra hint/outcome metrics, and read-time rescoring are intentionally not carried forward. PR #161 is also closed as superseded by the merged completed-result provider/API/browser stack.

## September 25 points-v4 extension

> Historical note: the September 25 extension was first implemented against the inactive signed/integer v4 draft. Before public activation or any persisted v4 production result, v4 was finalized on September 26 as 4/3/2/1/0.5/0. The comparison architecture remains exact-version; the current v4 domain below reflects that final pre-activation contract.

The original read service remains the production points-v3 boundary. Row G2 adds pure provider-neutral normalization alongside it rather than widening the repository contract before the provider is ready.

- `DailyNineComparisonRulesetVersion` and exact-version comparison identities cover points-v3 and points-v4.
- Pure at-bat normalization validates provider count/sum statistics against engine-owned per-AB ranges and score steps: v3 0..7 in integer steps and v4 0..4 in 0.5-point steps.
- Pure completed normalization asks the engine for the nine-AB range/step and builds a step-aware histogram. V3 remains 64 entries for 0..63; v4 is 73 entries for 0..36 in 0.5-point steps, with index `(score - minimumScore) / step`.
- Strict-lower finish rate resolves each histogram index back to its actual score, so fractional v4 values and ties are handled correctly.
- At the G2 checkpoint, `DailyNineComparisonRepository`, `DailyNineComparisonKey`, and service read methods deliberately remained points-v3-only. G3B subsequently widened that server/provider read port to exact-version v3/v4; the shared HTTP/read-service/browser boundary still rejects v4 until H.

Scope: `tasks/plans/points-v4-comparison-domain.md`.
