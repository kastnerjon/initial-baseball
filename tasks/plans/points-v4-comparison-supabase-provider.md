# Points-v4 Supabase comparison provider

Status: row G3B implementation scope; server/provider compatibility only, not public browser activation  
Date: 2026-09-25

> September 26 follow-up: the provider seam and access model remain intact, but inactive v4 was redefined before activation to 0.5-point nonnegative scoring. Migration `20260926220726_redefine_points_v4_fractional_scoring` changes the point-valued RPC returns to exact numeric values; the original signed-integer proof below remains historical evidence for the earlier draft only. See `tasks/plans/points-v4-half-walk-zero-strikeout.md`.

## Scope contract

- **Goal:** make the deployed Daily Nine comparison provider truthfully support exact-version `points-v3` and `points-v4` populations, including exact half-point v4 at-bat sums and completed-score buckets, without exposing v4 through the existing HTTP/browser comparison contract.
- **Owning layers:** `packages/daily` comparison read port/service plus the server-only Supabase comparison adapter and its two aggregate functions.
- **In scope:** widen Daily repository/service query types from v3-only to supported Daily Nine v3/v4; accept safe half-point provider sums/scores while retaining integer counts; keep exact score-domain validation in Daily/engine-owned math; widen both SQL aggregate functions to the explicit supported set `points-v3`/`points-v4`; preserve service-role-only function execution; focused provider/domain tests; hosted migration/readback/rollback-only signed-data proof; canonical docs.
- **Out of scope:** shared comparison HTTP schema; `dailyNineComparisonReadService` v4 acceptance; browser client/hooks/prefetch; scorecards/shares; result submission activation; archive routes; current scoring default; rollups/cache/index changes; Classic comparison semantics.
- **Acceptance checks:** v3 provider reads remain unchanged; a v4 AB aggregate may carry half-point sums; v4 completed buckets may contain 0..36 half-point values; Daily still rejects impossible exact-version aggregates; Classic/unknown rulesets do not become Daily Nine comparison populations; SQL remains aggregation-only and contains no scoring formula; function ACL remains postgres/service_role only; no durable verification rows remain.
- **Stop conditions:** any need to change the shared HTTP API, browser accepted ruleset, scoring formula, result-write routing, public default, or storage strategy becomes H/later work.

## Boundary decision

G2 intentionally kept `DailyNineComparisonRepository` and `DailyNineComparisonService` v3-only because the deployed Supabase provider could not truthfully serve the then-defined v4 value domain. G3A then made immutable result storage exact-version v3/v4-capable. G3B widens the provider and port together, eliminating that temporary type mismatch.

The Supabase decoder is deliberately structural rather than scoring-aware: counts remain positive/non-negative as appropriate, while aggregate point sums and bucket scores may be safe half-point values. The Daily comparison normalizer remains the owner of exact-version score-range validation through `getDailyPointsRange`. This avoids copying 4/3/2/1/0.5/0 or 0..36 scoring policy into the adapter.

## SQL contract

Migration `20260925193811_widen_points_v4_comparison_reads` replaces the existing function bodies without changing signatures:

- `daily_nine_at_bat_comparison(...)` returns count plus stored awarded-point sum for one exact v3/v4 puzzle/ruleset/slot population;
- `daily_nine_completed_score_buckets(...)` returns persisted completed-score buckets for one exact v3/v4 puzzle/ruleset population;
- both explicitly gate `p_ruleset_version in ('points-v3', 'points-v4')`, so Classic is not accidentally treated as Daily Nine points comparison;
- both remain `STABLE`, `SECURITY INVOKER`, `search_path = ''`, and service-role-only via explicit revoke/grant;
- SQL aggregates persisted engine-derived values and does not re-score gameplay facts.

No new table, index, rollup, cache, trigger, policy, or browser privilege is added.

## Hosted verification

Before source merge, production migration/readback verifies the exact function definitions and ACL. Empty v4 calls return the expected zero/empty aggregate shape, while Classic remains excluded.

A rollback-only transaction inserted two temporary v4 at-bat rows (-1 and 4) and two temporary completed rows (-9 and 36). The live functions returned at-bat count 2 / signed sum 3 and two completed buckets with aggregate point sum 27. The transaction rolled back and a cleanup query confirmed zero `g3b_tmp_%` rows persisted.

Existing production populations are not rewritten. The migration changes only read functions.

## Public activation boundary

The schema-1 comparison HTTP contract still names `points-v3`, `dailyNineComparisonReadService` still rejects `points-v4`, and browser comparison consumers therefore remain v3-only. A regression test explicitly preserves that rejection. H can widen those layers only after browser persistence/result delivery/scorecard handling is ready for fractional v4 values.

## Verification

Focused tests cover:
- generic v3/v4 Daily comparison service routing;
- fractional v4 Supabase AB sums and completed buckets;
- v3 compatibility and malformed provider rows;
- explicit continued HTTP read-service rejection of v4.

Repository CI, documentation-impact, exact-head Vercel Preview, hosted function-definition/ACL readback, Supabase advisors, and fresh-eye patch review are required before merge.

## Documentation impact

Update START-HERE, todo, the September 24 roadmap, data-model/architecture handoffs, and the G2/G3A plans so server/provider v4 compatibility is recorded while H remains the public/browser activation boundary.
