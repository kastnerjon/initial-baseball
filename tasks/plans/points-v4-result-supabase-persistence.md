# Points-v4 Supabase result persistence

Status: row G3A implementation scope; result storage only, not comparison/browser activation  
Date: 2026-09-25

> September 26 follow-up: the storage seam remains the same, but inactive v4 was redefined before activation as a half-point nonnegative ruleset. Migration `20260926220726_redefine_points_v4_fractional_scoring` supersedes the original v4 bounds/type assumptions without rewriting this historical migration. See `tasks/plans/points-v4-half-walk-zero-strikeout.md`.

## Scope contract

- **Goal:** make the existing immutable Supabase result providers safely persist and read exact-version `points-v4` completed results and terminal at-bat observations while preserving every `points-v3` and Classic storage invariant.
- **Owning layer:** `apps/web` Supabase result adapters plus the supporting Postgres result-table constraints.
- **In scope:** v4 result-row encode/decode support; engine-owned range/step validation in provider codecs; conditional database bounds for v3 versus v4; completed-result v4 ruleset allowance; existing first-write-wins repository behavior; focused provider tests; hosted RLS/privilege/schema verification; canonical documentation.
- **Out of scope:** comparison RPCs and comparison-provider decoding; widening `DailyNineComparisonRepository`; shared comparison HTTP/browser acceptance; journal/outbox/save compatibility; scorecards/sharing/how-to copy; archive routes; public-default scoring; rollups/cache/projections; unrelated Supabase hardening such as issue #247.
- **Acceptance checks:** v3 at-bat points remain 0..7; v4 at-bat points are 0..4 in 0.5-point steps; v3 completed points remain 0..63; v4 completed points are 0..36 in 0.5-point steps; Classic completed rows remain valid; exact ruleset identity remains part of immutable keys/populations; no update/upsert path appears; RLS and service-role SELECT/INSERT-only posture remain unchanged; existing hosted v3/Classic rows remain valid.
- **Stop conditions:** any need to change portable result contracts, public routes, comparison interfaces, browser persistence, scoring formulas, or immutable write semantics becomes a separate PR.

## Why G3 is split

Live inspection showed two independently reviewable seams:

1. result persistence: the result codecs and table constraints still reject v4;
2. comparison reads: both aggregate RPCs explicitly gate on `points-v3`, while the web decoder accepts only non-negative sums/buckets and the deployed repository type still intentionally claims v3 only.

This PR is G3A and changes only the first seam. G3B subsequently widens the comparison RPC/provider boundary after storage truthfully supports exact-version v4 rows; public HTTP/browser acceptance still remains H.

## Storage boundary

The TypeScript row codecs ask the engine for the score range instead of copying scoring constants. They still decode only already-normalized provider rows; they do not derive a score from baseball facts.

Postgres does not implement the scoring formula. It enforces persisted contract bounds only:

- `daily_at_bat_results`: v3 integer `0..7`; v4 exact numeric `0..4` in 0.5-point steps;
- `daily_completed_results.summary.points`: integer v3 `0..63`; v4 `0..36` in 0.5-point steps;
- Classic completed rows bypass the points-summary range check.

The ruleset discriminator is part of each constraint, so widening v4 cannot silently relax v3's integer/nonnegative contract.

## Hosted pre-migration checkpoint

Read-only inspection on September 25 found:

- 239 `daily_at_bat_results` rows, all `points-v3`, range 0..7;
- 28 `daily_completed_results` rows: 27 `points-v3` and 1 `classic-inning-v1`;
- current v3 completed points range 0..46, with every checked v3 summary inside 0..63 and maximumPoints 63;
- RLS enabled on both result tables with no policies;
- no `anon` or `authenticated` direct result-table grants;
- `service_role` has only `SELECT, INSERT`;
- comparison RPCs remain service-role-only and v3-gated.

No production row is fabricated to prove v4.

## Reversibility

Before browser/API activation, a rollback can restore the old v3-only constraints because no normal application path can create v4 rows. After a later release begins storing v4, restoring the old constraints would first require an explicit policy for those retained historical v4 rows. This PR therefore remains forward-compatible storage preparation, not permission to discard v4 history later.

## Verification

Focused tests cover v3/v4 codec bounds, v4 provider round-trips, existing conflict/idempotency behavior and Classic compatibility. Repository CI, documentation-impact, file-size/data gates and exact-head Preview remain required.

Before merge, apply the reviewed migration, then verify hosted constraints, row populations, RLS/policies, direct grants and unchanged comparison RPC privileges. Run Supabase security/performance advisors and distinguish pre-existing findings from any new issue.

## Documentation impact

Update `docs/START-HERE.md`, `tasks/todo.md`, the September 24 roadmap, the data-model/architecture handoffs and engine boundary language so they record G3A as storage compatibility only and leave G3B comparison-provider widening plus H browser/default activation pending.
