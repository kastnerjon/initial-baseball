# Supabase

Supabase is the operational persistence layer for Initial Baseball. Portable game, Daily lifecycle, lineup validation, and publication rules live outside Supabase and must not be reimplemented in SQL, triggers, or Edge Functions.

Use migrations for durable schema/extension changes and keep the repository migration files aligned with hosted state. Apply hosted changes deliberately and verify them after deployment.

For Daily editorial mutations, the authoritative path is the server-side Daily workflow and `packages/daily` lifecycle over the Supabase repository adapter. Do not write `daily_editorial_puzzles` directly from browser code, assistant tooling, SQL transport helpers, or Edge Functions.

The conversational lineup transport is intentionally narrow: `private.dispatch_daily_lineup_chatops(...)` uses `pg_net` plus a token stored in Supabase Vault only to forward one JSON request to the authenticated application route. It contains no lineup or lifecycle rules and is not exposed through the Data API.
