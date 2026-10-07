# Private daily archive scheduler

Status: #314 merged; migration, schedule, transport, catch-up and immutable retry verified
Last updated: 2026-10-07

## Scope contract

- Goal: invoke the deployed completed-day rollover without an owner click or site visit.
- Owning layer: Supabase operational transport, with all date/publication/issuance policy remaining in apps/web.
- In scope: one migration enabling pg_cron, one private SECURITY INVOKER transport, one named UTC cron job, operational runbook and canonical handoff.
- Out of scope: tables, result data, lifecycle SQL, new credentials, permanent epoch, browser comparisons/history and unrelated QA.
- Acceptance: bounded review, exact-head CI/READY Preview; migration application; verify schedule, owner, function security/search_path and denied browser-role execution; authenticated dispatch; completed-only exact ordered source copies; immutable retry; original October 4 timestamp/fingerprint; zero permanent rows; canonical routes and runtime error scan; final operational docs reconciliation.
- Stop: unavailable existing Vault credential, denied migration access or conflicting job identity require an explicit blocker; no alternate public transport or direct editorial writes.

## Architecture decision

The October 7 owner authorization includes automatic completed-day archiving. App PR #313 merged as cffe400cc797e8bba4c883d9db7876d1f73aebcf after its one bounded review, fixed historical-read finding, exact-head CI #1061 attempt 2 and READY Preview. The unchanged first attempt encountered the separately tracked #301 timeout; no check was weakened. Exact app production dpl_G5HmQX4ZTivnm65jrNrYfxaAcYd9 is READY/canonical; expected public routes and scoped error/fatal scan passed. Push CI #1062 passed. Production verification precedes activation.

A private postgres-owned pg_cron job calls SECURITY INVOKER transport `private.dispatch_daily_archive_rollover()` at `0 7,8 * * *` UTC. Those passes cover midnight America/Los_Angeles in both DST states; the app owns its Pacific cutoff and catches up completed dates. Transport reads the existing `daily_chatops_token` from Vault, calls the deployed POST with pg_net, and returns only the request ID. No content, dates or lifecycle logic reside in SQL. All public/anon/authenticated execution is revoked; no browser or result-table privilege is added.

Cron success means HTTP enqueue, not successful archive issuance. The runbook requires inspecting the corresponding pg_net response and authoritative archive/source readback; HTTP 503 or timeout must not be assumed to mean zero writes. Repeated dispatch preserves already-issued copies.

## Verification state

The post-merge activation checkpoint below records the applied migration, active job and exact readback.

## Operational checkpoint scope

- Goal: make canonical resumption docs match the now-applied private scheduler and verified catch-up.
- Owning layer: repository documentation only.
- In scope: START-HERE/todo, product timing statement, runbook and the two archive scope plans; exact release/activation/readback evidence.
- Out of scope: runtime/SQL changes and outstanding archive comparison/history/mobile work.
- Acceptance: remove stale pending claims; one bounded review; documentation tests/gate, exact-head CI/READY Preview, post-merge CI/production routes/logs and read-only database/schedule recheck.
- Stop: any new runtime defect becomes its own concern; do not edit code under the documentation scope.

## Release and hosted activation

Final head 156be1b848da7cc3bed2fc74b4e9d2fa6677a339 passed CI #1063 and READY Preview dpl_EjLtpuwAWV4KZ81gvSnvvYHHHceT; the one bounded review completed without findings/threads. #314 merged as d8490a9647dc35d3919ddff12ee4f5d8c83381ea. Push CI #1064 passed; exact production dpl_9d89F4rUJTW2MYmY1xvU3mdnGW6v is READY/canonical, expected routes passed and the post-READY scoped error/fatal scan was empty.

Migration enable_daily_archive_scheduler applied successfully (hosted ledger version 20261007145533). Verified pg_cron 1.6.4/pg_net 0.20.4; active job 1 daily-archive-rollover, exact `0 7,8 * * *`/GMT/command/postgres owner. Transport SECURITY INVOKER, search_path=pg_catalog, postgres owner; anon/authenticated cannot execute or use private schema. No new security advisor findings from baseline.

Request 88: HTTP 200, cutoff 2026-10-07, created 2/preserved 1/remaining 0/failures []. Request 89: HTTP 200, created 0/preserved 3/remaining 0/failures []. Readback proves exact editorial/clue order and nine IDs/clues, schema 2 and correct beta identities. October 5 source revision 10 and corrected October 6 revision 11 are published by system:archive-rollover with unchanged selection fingerprints. Issued rows #2/#3 use first timestamp 2026-10-07T14:56:04.720Z and fingerprints 2d3226a9bac2df29aeed027c41e7d96d / b8cbe0d094ae83b871aacdcca835a721; retry preserved both snapshots, timestamps and source publication audit. October 4 retains 2026-10-05T01:39:24.760Z / bfb08ff7892362e0762d858aa3920d53. Today source remains scheduled revision 5, zero current/future beta rows and zero permanent rows.

Catalog lists #1/#2/#3; #2/#3 200, today #4 404. Original corrected October 6 Daily completed/per-slot comparisons stayed unchanged and private/no-store, while archive #3 reads its separate empty population. No game results were submitted. Actual next-midnight firing remains a future observation; configured cron and authenticated transport/issuance are verified. Final documentation checkpoint reconciles the handoff; no runtime change is included.
