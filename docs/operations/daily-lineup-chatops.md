# Daily lineup ChatOps

Status: server adapter merged in PR #152; private Supabase transport and production credential activation remain to be completed and smoke-tested.

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
- `canonicalPlayerIds`: exactly nine unique reviewed canonical Daily candidate IDs in batting order;
- `schedule`: explicit boolean.

Authorization is a dedicated `Bearer` token from server-only `DAILY_CHATOPS_TOKEN`. The configured token must contain at least 32 characters and is compared through a timing-safe digest. Authorization occurs before the privileged Supabase repository is constructed. Successful mutations are audited as `chatops:assistant`.

The route:

1. validates the request shape and calendar date;
2. ensures the requested future date has a draft record;
3. validates all requested IDs against the reviewed Daily candidate universe;
4. atomically replaces all nine selections through the portable Daily lifecycle;
5. reruns the existing horizon/lineup validation and returns warnings for conversational review;
6. optionally schedules only when `schedule: true` was explicit;
7. returns the persisted date, puzzle number, status, revision, validation result, and resolved ordered selections.

Published and archived puzzles remain immutable. Replacing a scheduled future lineup returns it to draft before an explicit schedule transition. Repository optimistic-revision semantics remain intact.

## Conversational operating procedure

When the owner supplies a lineup:

1. preserve the supplied batting order;
2. resolve each name to one canonical player ID using the existing canonical search/identity system;
3. never guess through a missing or ambiguous identity; surface ambiguity and request the one needed clarification;
4. present meaningful validation warnings rather than silently weakening repeat protection or eligibility rules;
5. ask whether to schedule when that intent is not already explicit;
6. call `private.dispatch_daily_lineup_chatops(puzzle_date, canonical_ids, schedule)` through the connected Supabase project;
7. capture the returned `pg_net` request ID, then inspect `net._http_response` for the corresponding status/body after the asynchronous request completes;
8. only treat the operation as successful when the HTTP response is 2xx and its persisted readback exactly matches the requested date, order, status, and nine canonical players.

Do not publish from this conversational operation. Publication remains a separate lifecycle action.

## One-time production setup

1. Connect the Supabase app to ChatGPT for the Initial Baseball project. Completed September 16, 2026: project `initial-baseball-db` / `dwreeiydvwikpamlokji`.
2. Merge and apply the private transport migration that enables `pg_net` and installs `private.dispatch_daily_lineup_chatops(...)`.
3. Generate one random secret of at least 32 characters outside chat. Do not paste it into a conversation or commit it.
4. Add that value to Vercel as `DAILY_CHATOPS_TOKEN` for Production, then redeploy so the route can read it. Add Preview only when preview QA is desired.
5. Store the same value in Supabase Vault under the unique name `daily_chatops_token`. Do not hard-code it in SQL, source control, logs, or browser code.
6. Verify the production route fails closed without/with an incorrect credential.
7. Dispatch a future-draft smoke test through the Supabase transport, inspect `net._http_response`, and verify exact persisted readback before scheduling.

## QA gate

Before routine production use:

- request parser rejects malformed/impossible dates, wrong counts, duplicates, empty IDs, and implicit schedule intent;
- auth rejects absent, short, and incorrect tokens without exposing the configured value;
- full-lineup replacement is one optimistic-revision save and preserves exact order;
- unknown/non-reviewed players are rejected before mutation;
- current/past dates are rejected;
- published/archived puzzles remain immutable;
- scheduled replacement returns to draft and only explicit scheduling restores `scheduled`;
- cache invalidation still runs through the existing repository wrapper;
- validation warnings are returned for conversational review;
- the response readback exactly matches the requested nine;
- the private transport is not executable by `public`, `anon`, or `authenticated` and the `private` schema is not exposed through the Data API;
- no future lineup content appears in public GitHub surfaces or browser payloads;
- full CI, documentation checks, preview deployment, production deployment, unauthorized-failure check, and one future-draft smoke test pass.

## Deferred

The admin UI may be redesigned later, but it is intentionally out of scope. Automatic publishing, published-puzzle correction/versioning, bulk lineup recipes, and direct assistant database writes are also out of scope.
