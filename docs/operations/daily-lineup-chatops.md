# Daily lineup ChatOps

Status: operational in production; smoke-tested September 16 and exercised for routine owner-supplied future lineups September 17, 2026.

## Goal

Allow the owner to provide a future Daily date and nine players in conversation and have an authorized assistant apply that exact lineup without manually editing nine slots in `/admin/daily`.

This is an operational adapter only. It does not replace the existing admin UI, lineup generator, lifecycle, validation, repository, or publication model.

## Architecture

The authoritative mutation path remains:

`assistant request -> private Supabase transport -> authenticated server adapter -> Daily admin workflow -> packages/daily lifecycle -> Supabase repository`

`packages/daily` continues to own lifecycle and lineup-domain behavior. Supabase remains persistence only. The assistant must never write `daily_editorial_puzzles` directly.

The repository is public, so future lineup payloads must never be placed in GitHub issues, pull requests, commits, Actions inputs, or other public repository surfaces. GitHub is not the ChatOps transport.

The private transport is `private.dispatch_daily_lineup_chatops(...)`, installed by `supabase/migrations/20260916130000_enable_daily_chatops_transport.sql`. It uses `pg_net` to forward JSON to the production ChatOps route and reads the bearer token from Supabase Vault at request time. The function is `SECURITY INVOKER`, lives in the non-exposed `private` schema, and has execution revoked from `public`, `anon`, and `authenticated`. It contains no lineup or lifecycle rules.

## Server boundary

`POST /admin/daily/chatops` accepts a JSON object containing:

- `puzzleDate`: `YYYY-MM-DD`;
- `canonicalPlayerIds`: exactly nine unique canonical, reveal-ready Daily-compatible player IDs in batting order;
- `schedule`: explicit boolean.

Automatic generation remains restricted to ranked `dailyEligiblePlayers`. Authorized manual ChatOps replacement may select a canonical, reveal-ready player outside that automatic pool. Such a selection remains unranked for automatic generation and returns the advisory validation warning `outside-automatic-daily-pool`; it does not promote the player into `dailyEligiblePlayers` or change future generated lineups.

Authorization is a dedicated `Bearer` token from server-only `DAILY_CHATOPS_TOKEN`. The configured token must contain at least 32 characters and is compared through a timing-safe digest. Authorization occurs before the privileged Supabase repository is constructed. Successful mutations are audited as `chatops:assistant`.

The route:

1. validates the request shape and calendar date;
2. ensures the requested future date has a draft record;
3. validates all requested IDs against the canonical, reveal-ready manual editorial candidate universe;
4. atomically replaces all nine selections through the portable Daily lifecycle;
5. reruns the existing horizon/lineup validation and returns rank-band, repeat, automatic-pool, and other warnings for conversational review;
6. optionally schedules only when `schedule: true` was explicit;
7. returns the persisted date, puzzle number, status, revision, validation result, and resolved ordered selections.

Published and archived puzzles remain immutable. Replacing a scheduled future lineup returns it to draft before an explicit schedule transition. Repository optimistic-revision semantics remain intact.

## Conversational operating procedure

When the owner supplies a lineup:

1. preserve the supplied batting order;
2. resolve each name to one canonical player ID using the existing canonical search/identity system;
3. never guess through a missing or ambiguous identity; surface ambiguity and request the one needed clarification;
4. present meaningful validation warnings rather than silently weakening repeat protection, automatic eligibility, reveal readiness, or identity rules;
5. treat `outside-automatic-daily-pool` as an advisory manual-curation warning, not a reason to substitute a different player without the owner's instruction;
6. ask whether to schedule when that intent is not already explicit;
7. call `private.dispatch_daily_lineup_chatops(puzzle_date, canonical_ids, schedule)` through the connected Supabase project;
8. capture the returned `pg_net` request ID, then inspect `net._http_response` for the corresponding status/body after the asynchronous request completes;
9. on a normal 2xx response, require the returned persisted readback to exactly match the requested date, order, status, and nine canonical players;
10. if `pg_net` reports a transport timeout, do **not** blindly retry: first read the authoritative editorial record for that date. If the exact nine/order/status and `chatops:assistant` audit metadata are already persisted, treat the mutation as completed and record the timeout as a transport anomaly. Retry only when authoritative readback proves the requested mutation did not complete.

Do not publish from this conversational operation. Publication remains a separate lifecycle action.

This procedure is intentionally durable across chats. A future assistant should begin with `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md`, then use this runbook for lineup operations. The Supabase connection must be available in that chat; if it is not connected, reconnect the existing Initial Baseball Supabase project rather than inventing another transport.

## Production setup — completed September 16, 2026

1. Supabase app connected to project `initial-baseball-db` / `dwreeiydvwikpamlokji`.
2. Private transport migration merged/applied; `pg_net` and `private.dispatch_daily_lineup_chatops(...)` are active.
3. A random 64-character machine credential was generated without exposing it in chat.
4. `DAILY_CHATOPS_TOKEN` is configured in Vercel Production and production was redeployed so the route reads it.
5. The matching credential is stored in Supabase Vault as `daily_chatops_token`; it is not hard-coded in SQL, source control, logs, or browser code.
6. The transport reached the production route successfully. An invalid Daily candidate was rejected atomically with HTTP 400 before any lineup mutation.
7. The corrected September 18, 2026 / Daily #145 lineup was dispatched through the private transport, persisted in exact batting order, and scheduled. The persisted record reached revision 2 with `scheduled_by` and `updated_by` equal to `chatops:assistant`.
8. On September 17, owner-supplied future Dailies #149–#151 were resolved through the canonical identity system, persisted in exact batting order through the private transport, and scheduled. The persisted seven-day horizon then covered Dailies #145–#151 with no draft gaps. Future player names and canonical IDs remain intentionally absent from public repository history.
9. One routine dispatch timed out at the `pg_net` transport after the server had already committed the exact scheduled lineup. Direct authoritative readback confirmed revision 2, exact order, and `chatops:assistant` attribution before any retry; a second routine dispatch returned HTTP 200 normally.

## QA gate

Verified before routine production use:

- request parser rejects malformed/impossible dates, wrong counts, duplicates, empty IDs, and implicit schedule intent;
- auth rejects absent, short, and incorrect tokens without exposing the configured value;
- full-lineup replacement is one optimistic-revision save and preserves exact order;
- unknown, non-canonical, or non-reveal-ready players are rejected before mutation;
- reveal-ready manual players outside the automatic Daily pool may be selected and are surfaced with `outside-automatic-daily-pool` rather than being silently promoted into automatic generation;
- current/past dates are rejected;
- published/archived puzzles remain immutable;
- scheduled replacement returns to draft and only explicit scheduling restores `scheduled`;
- cache invalidation still runs through the existing repository wrapper;
- validation warnings are returned for conversational review;
- normal 2xx response readback exactly matches the requested nine;
- timeout recovery checks the authoritative editorial row before retrying and never assumes that a transport timeout means the server mutation failed;
- the private transport is not executable by `public`, `anon`, or `authenticated` and the `private` schema is not exposed through the Data API;
- no future lineup content appears in public GitHub surfaces or browser payloads;
- full CI, documentation checks, preview deployment, production deployment, credential activation, production transport dispatch, atomic rejection, exact persisted readback, and explicit scheduling were exercised.

## Deferred

The admin UI may be redesigned later, but it is intentionally out of scope. Automatic publishing, published-puzzle correction/versioning, bulk lineup recipes, and direct assistant database writes are also out of scope.