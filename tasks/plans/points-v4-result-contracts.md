# Points-v4 portable result contracts

Status: row G1 implementation scope; portable result acceptance only, not storage or browser activation  
Date: 2026-09-25

> September 26 follow-up: this contract shape remains valid, but the inactive v4 scoring semantics were finalized before activation as 4/3/2/1/0.5/0. The earlier negative/integer values in the initial checkpoint are superseded by `tasks/plans/points-v4-half-walk-zero-strikeout.md`.

## Scope contract

- **Goal:** allow portable schema-1 resolved-at-bat and completed-result contracts to represent and engine-derive exact-version `points-v4` results while preserving all `points-v3` behavior.
- **Primary owner:** `packages/engine` result validation/derivation, with the minimum shared transport-type widening and Daily idempotency consumer adaptation required by that contract.
- **In scope:** v4 result-version unions, at-bat validation/awarded-point derivation, completed-result validation/summary derivation, exact-version Daily idempotency equality, focused v3/v4 boundary tests, and canonical documentation.
- **Out of scope:** portable comparison histogram/range work, Supabase row codecs/constraints/RPCs/migrations, HTTP/API/browser submission support, browser journal/outbox/save compatibility, scorecards/sharing/how-to copy, archive activation, and switching `CURRENT_DAILY_RULESET_VERSION`.
- **Acceptance checks:** v4 correct outcomes score 4/3/2/1/0.5 regardless of wrong guesses 0–2; strikeout/Give Up score 0; nine-HR completion derives 36; nine-K completion derives 0; v3 still derives 0..63 under its existing deduction formula; exact-version mismatch rejects; v3/v4 records remain distinct idempotency populations; points-v1/v2/legacy remain unsupported result submissions.
- **Stop conditions:** if making the portable result contract useful requires database/provider/API/browser widening or comparison-domain redesign, stop and leave that work to G2/G3/H.

## Architecture

Shared owns only the stable transport/version discriminants. Engine remains the sole authority for validating native facts and deriving points/completion. Daily receives already-normalized results and only compares exact immutable fields for first-write-wins idempotency; it does not score.

The schema version remains 1 because the transport shape is unchanged. `rulesetVersion` is the semantic discriminator. Historical v3 rows/results are not reinterpreted.

This PR deliberately creates a staged compatibility window: pure validation can understand v4 before persistence and browser transport can store/send it. The current web paths still resolve authoritative gameplay as v3, and existing Supabase codecs/constraints still reject v4. That fail-closed boundary is intentional until G3.

## Verification

Focused coverage belongs in shared/engine/Daily package tests. Repository-required CI remains authoritative for full typecheck, tests, file-size guard, data pipeline/QA and package build order. Exact-head Preview is required before merge.

Supabase verification is not applicable to G1 because no schema, row codec, repository, RPC, privilege or hosted data changes are made.

## Documentation impact

Update the engine/data-model/architecture/product handoffs, START-HERE, todo and the September 24 roadmap so they distinguish portable v4 result acceptance from still-pending comparison, storage/provider and browser activation.
