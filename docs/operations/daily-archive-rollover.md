# Automatic daily archive rollover

Status: operational; transport, catch-up and immutable retry verified October 7
Last updated: 2026-10-07

## Operation

App PR #313 owns completed-date policy, optimistic publication, immutable issuance and read-back. `POST /admin/daily/archive-beta/rollover` accepts the existing private ChatOps bearer credential or administrator Basic authorization before database access. It accepts no caller date or lineup. Only dates strictly before today in America/Los_Angeles are eligible, starting with disposable beta October 4, 2026. Existing copies remain unchanged. Stored scheduled/published source is required; missing/draft historical content fails explicitly and is never reconstructed as historical authority.

`supabase/migrations/20261007145533_enable_daily_archive_scheduler.sql` enables pg_cron and creates `private.dispatch_daily_archive_rollover()`. The function only forwards an empty JSON request using pg_net and the existing Vault `daily_chatops_token`. It is SECURITY INVOKER with fixed pg_catalog search_path and execution revoked from public, anon and authenticated. The named postgres-owned job `daily-archive-rollover` runs `0 7,8 * * *` UTC, covering midnight Pacific in both DST states. The other pass provides another completed-date scan. No visitor request or manual publication is required.

## Recovery and monitoring

Use the connected Initial Baseball Supabase project `dwreeiydvwikpamlokji`.

1. Inspect `cron.job` for this named job's active flag, UTC schedule, command and postgres owner. `cron.job_run_details` proves SQL execution only; a successful cron run means the HTTP request was enqueued.
2. For an authorized recovery, execute `select private.dispatch_daily_archive_rollover();` and retain its request ID.
3. Inspect `net._http_response` for that ID after the asynchronous request completes. HTTP 200 must report zero failures/remaining; the metadata-only body reports cutoffDate, created and preserved. HTTP 503 means partial work or a missing authority/provider failure.
4. Read back `permanent_daily_issued_puzzles` under exact `archive-beta-v1`, comparing ordered canonical IDs with the stored same-date editorial selections, nine frozen clues, stable date/number/ID and first timestamp. Original Daily source stays published for delayed native result delivery.
5. On timeout/503, read authoritative rows before retrying. Publication or issuance may already have committed. Retry through the same endpoint; do not write editorial/archive tables directly, replace snapshots, or regenerate clues for existing copies. Sanitized per-date failures require source/provider investigation. Missing historical source or immutable conflict requires editorial review.
6. Confirm today's/future dates and `permanent-v1` remain excluded, `/archive` lists eligible copies, issued `/archive/N` plays, and today's/unissued numbers return 404. Monitor sanitized archive-rollover error events in the exact production deployment logs.

The pg_net response store is transient; record important response/readback evidence in the repository operational checkpoint. No credential values or future lineup answers belong in logs, issues, commits or PRs.

## Pause

To pause only this operation, unschedule the named `daily-archive-rollover` job through an authorized operational change. Keep the private transport and issued copies; do not drop pg_cron/pg_net or disturb other jobs. After repair, reinstall the named schedule and dispatch recovery to catch up completed dates. Permanent launch, browser archive AVG/BEAT and local history are separate work.

## October 7 activation evidence

App #313 and scheduler #314 are merged; scheduler merge d8490a9647dc35d3919ddff12ee4f5d8c83381ea passed push CI #1064 and exact READY/canonical production dpl_9d89F4rUJTW2MYmY1xvU3mdnGW6v. The hosted migration is applied; the checked-in timestamp now matches hosted ledger version 20261007145533 exactly, with unchanged SQL; active job 1 has the exact named schedule/command, postgres ownership and GMT timezone. Private transport security/search_path and denied browser-role schema/function access passed; advisor findings match the pre-migration baseline.

Request 88 returned HTTP 200 with created 2/preserved 1/no failures or remaining; request 89 returned 200 with created 0/preserved 3. October 5/#2 and corrected October 6/#3 have exact editorial/clue order, nine IDs/clues and published revisions 10/11. All issue timestamps/snapshots and publication audit remained stable on retry. October 4's original first timestamp/fingerprint is unchanged. Today is untouched; permanent and today/future beta rows remain zero. Catalog #1–#3 and playable #2/#3 returned 200; today's #4 returned 404. Original October 6 Daily comparison reads remained unchanged and separate from archive #3. No hosted game result was written for QA. Actual next-midnight cron execution is a future observation; scheduling and the authenticated dispatched operation are verified.
