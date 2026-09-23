# Permanent Daily issued-puzzle contract

Status: implemented portable contract

## Scope contract

- **Goal:** define the immutable issued-puzzle snapshot and first-write-wins persistence semantics for the future permanent Daily series.
- **Owning layer:** `packages/daily`.
- **In scope:** schema-1 issued snapshot, stable permanent puzzle ID, exact ordered nine canonical player IDs, issue timestamp, provider-neutral repository port, idempotent same-content reissue, immutable conflict detection, focused tests, exports, and canonical documentation.
- **Out of scope:** choosing/configuring the launch date, Supabase tables/adapters, archive read routes, browser history, archive UI, scoring changes, or choosing the permanent game/ruleset.
- **Acceptance checks:** exactly nine unique player IDs are frozen in order; the puzzle ID is stable for a permanent identity; the first issue timestamp is retained; exact retries are idempotent; conflicting rewrites are rejected; beta numbering/data remain untouched.
- **Stop conditions:** provider-specific persistence, route composition, or launch-product selection belongs in later bounded PRs.

## Contract

The snapshot schema is version 1 and contains:

- the existing `permanent-v1` identity;
- stable puzzle ID `permanent-v1-daily-N`;
- exactly nine ordered canonical player IDs;
- the timestamp of the first successful issue.

The provider-neutral repository is first-write-wins. The service accepts an exact retry as `existing` even when the retry carries a later attempted timestamp, because the first stored issue timestamp remains authoritative. Any different immutable content for the same permanent identity is an `immutable_conflict` and must not overwrite the existing puzzle.

## Deliberate separation from game/ruleset

The issued puzzle freezes **puzzle identity and answers**, not the still-unsettled broad-launch game/ruleset choice. Daily Nine/Classic and scoring versions remain separate game contracts. A later archive runtime binds a supported game/ruleset to the frozen puzzle instead of embedding today's beta choice into the permanent puzzle snapshot.

## Next boundary

A separate Supabase PR should implement this port with an append-only/first-write-wins table and readback on conflict. No archive route should exist until provider persistence is in place.
