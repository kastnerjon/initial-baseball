# Supabase

Supabase is the operational persistence layer for Initial Baseball. Portable game, Daily lifecycle, lineup validation, and publication rules live outside Supabase and must not be reimplemented in SQL, triggers, or Edge Functions.

Use migrations for durable schema/extension changes and keep the repository migration files aligned with hosted state. Apply hosted changes deliberately and verify them after deployment.

For Daily editorial mutations, the authoritative path is the server-side Daily workflow and `packages/daily` lifecycle over the Supabase repository adapter. Do not write `daily_editorial_puzzles` directly from browser code, assistant tooling, SQL transport helpers, or Edge Functions.

The conversational lineup transport is intentionally narrow: `private.dispatch_daily_lineup_chatops(...)` uses `pg_net` plus a token stored in Supabase Vault only to forward one JSON request to the authenticated application route. It contains no lineup or lifecycle rules and is not exposed through the Data API.

Automatic completed-day archiving uses the same private transport discipline. The named pg_cron job calls `private.dispatch_daily_archive_rollover()` through pg_net/Vault; only the application decides Pacific eligibility, publication and immutable issuance. Runbook: `docs/operations/daily-archive-rollover.md`.

The opt-in Daily Nine leaderboard stores only a display name linked to an existing immutable completed-result submission ID. Its ranking read is scoped to exact puzzle/ruleset, permitted to the server service role only, and derives scores from existing validated completion summaries; browser and anonymous roles have no table or RPC privileges. See `docs/product/daily-nine-leaderboard.md`.
