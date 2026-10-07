# Private daily archive scheduler

Status: implementation/review pending; hosted activation follows production verification
Last updated: 2026-10-07

## Scope contract

- Goal: invoke the deployed completed-day rollover without an owner click or site visit.
- Owning layer: Supabase operational transport, with all date/publication/issuance policy remaining in apps/web.
- In scope: one migration enabling pg_cron, one private SECURITY INVOKER transport, one named UTC cron job, operational runbook and canonical handoff.
- Out of scope: tables, result data, lifecycle SQL, new credentials, permanent epoch, browser comparisons/history and unrelated QA.
- Acceptance: bounded review, exact-head CI/READY Preview; migration application; verify schedule, owner, function security/search_path and denied browser-role execution; authenticated dispatch; completed-only exact ordered source copies; immutable retry; original October 4 timestamp/fingerprint; zero permanent rows; canonical routes and runtime error scan; final operational docs reconciliation.
- Stop: unavailable existing Vault credential, denied migration access or conflicting job identity require an explicit blocker; no alternate public transport or direct editorial writes.

## Architecture decision

The October 7 owner authorization includes automatic completed-day archiving. App PR #313 merged as cffe400cc797e8bba4c883d9db7876d1f73aebcf after its one bounded review, fixed historical-read finding, exact-head CI #1061 attempt 2 and READY Preview. The unchanged first attempt encountered the separately tracked #301 timeout; no check was weakened. Exact app production dpl_G5HmQX4ZTivnm65jrNrYfxaAcYd9 is READY/canonical; expected public routes and scoped error/fatal scan passed. Push CI #1062 is finishing. Production verification precedes activation.

A private postgres-owned pg_cron job calls SECURITY INVOKER transport `private.dispatch_daily_archive_rollover()` at `0 7,8 * * *` UTC. Those passes cover midnight America/Los_Angeles in both DST states; the app owns its Pacific cutoff and catches up completed dates. Transport reads the existing `daily_chatops_token` from Vault, calls the deployed POST with pg_net, and returns only the request ID. No content, dates or lifecycle logic reside in SQL. All public/anon/authenticated execution is revoked; no browser or result-table privilege is added.

Cron success means HTTP enqueue, not successful archive issuance. The runbook requires inspecting the corresponding pg_net response and authoritative archive/source readback; HTTP 503 or timeout must not be assumed to mean zero writes. Repeated dispatch preserves already-issued copies.

## Verification state

No hosted migration, scheduled job or backfill is claimed until the post-merge activation checkpoint.
