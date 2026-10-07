# Automatic archive-beta rollover

Status: App implementation locally verified; review/CI/deployment pending; scheduler follows separately
Last updated: 2026-10-07

## Scope contract

- Goal: completed Daily dates automatically acquire an immutable, playable archive copy without an owner publication click.
- Owning layer: apps/web server lifecycle orchestration and its existing hosting adapter.
- In scope: authenticated rollover service/recovery POST, completed-date archive visibility, focused tests, and canonical docs.
- Out of scope: permanent launch/epoch, new tables or grants, browser comparisons/history, scoring, accounts, speculative reconstruction of missing historical content.
- Acceptance: Pacific calendar boundary including DST; today/future excluded; authoritative stored scheduled/published nine used; publication locks before issuance; existing copies and timestamps never regenerated; failures do not prevent other dates; failed copies retry without republishing; no answers/provider details in output; authorization before all I/O; review, exact-head CI/READY Preview and production/database verification.
- Stop: any generated-lineup recovery requiring new historical authority or any permanent launch decision is separate work.

## Architecture decision

The owner authorized automatic daily rollover on October 7. The intended private Supabase scheduler invokes the existing machine-authenticated app transport at 07:00 and 08:00 UTC, covering Pacific midnight across DST and providing a second pass. Scheduler infrastructure is a separate bounded PR after the app endpoint passes deployment gates. This PR adds no scheduler or Vercel secret. Every invocation scans completed dates from the disposable October 4 epoch, so a missed day is recovered on a later run. Current/future scheduled records stay editable. Past scheduled content is published through the existing optimistic-revision lifecycle, then copied via existing append-only issuance/read-back. It remains published rather than editorial-archived so delayed original-Daily result writes and signed sessions retain their authoritative source. Archive public visibility changes to strictly before today's Pacific date.

Existing issued rows are read and retained without re-materializing clues, including October 4. Missing/draft historical source is an explicit failure, never a regenerated historical claim. Per-date failures are sanitized and other dates continue. Neither public catalog nor gameplay performs writes. No permanent rows or result populations are altered.

## Verified baseline / activation gate

Main 0ceff25877104cd1336093261f2a5454b7d88962 (#312), no open PRs. Latest production is READY. Read-only Supabase: one October 4 beta row; October 5/6 remain scheduled, October 6 revision 10 reflects the corrected edition. Vercel env metadata GET and CRON_SECRET POST both returned explicit 403 forbidden; no CLI executable is available. Vercel secret configuration is no longer needed: the endpoint reuses existing DAILY_CHATOPS_TOKEN authorization and the corresponding Vault-backed private transport. Basic administrator recovery remains supported with the same-origin check. Scheduler activation cannot be claimed until the separate migration and hosted dispatch are verified.

## Local verification

27 focused rollover/authorization/runtime tests passed; full workspace test run passed, including all 749 web tests across 106 files. Workspace typecheck/lint, file-size and whitespace checks passed. Strict baseball-data generation completed with zero critical issues; the production web build and hidden-answer QA passed (2 payloads, 34 client chunks). Generated pitcher-save and Next configuration side effects are excluded from the PR. Exact-head CI/READY Preview, one bounded hosted review and production checks remain required. No hosted issuance has been performed.
