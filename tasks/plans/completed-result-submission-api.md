# Completed-result submission API

Status: Active scope contract  
Date: 2026-09-17

## Goal

Expose one anonymous completed-game POST boundary that validates a submitted native completion against the authoritative Daily puzzle and stores only the engine-normalized result through the merged 4B service and Supabase provider.

## Owning layer

Web API / server composition.

## Architecture check

- `packages/engine` remains the sole validation and summary-derivation authority.
- `packages/daily` remains the sole idempotency-service authority.
- The Supabase provider remains a dumb persistence adapter.
- The route validates transport shape, calls a server composition service, and formats an HTTP response; it does not score or interpret baseball.
- The authoritative puzzle comes from the same cached server runtime source used by gameplay, not from client-submitted initials/totals.
- Browser submission identity/retry is a separate following PR.

## In scope

- add a server-facing public-puzzle lookup on the existing Daily runtime service so result validation does not create progression tokens or hint bundles;
- preflight only routing fields needed before puzzle lookup: object shape, schema version, real calendar date, supported ruleset, and non-future date;
- load the authoritative public puzzle for the requested date;
- call `validateDailyCompletedResult` with that puzzle and exact ruleset;
- store only a successful normalized result through `createDailyCompletedResultService` and the Supabase provider;
- add `POST /api/daily/results`;
- return private/no-store responses with deliberate created/existing/conflict/invalid/unavailable status mapping;
- focused service/route/runtime tests;
- update API, architecture, data-model, START-HERE, and todo documentation.

## Out of scope

- browser submission ID creation/storage;
- automatic retry/backoff, refresh retry, React hooks, or reset handling;
- comparison reads/aggregates/UI;
- rate-limit infrastructure or accounts;
- per-action writes;
- changing 4A/4B result contracts;
- archive/history;
- merging draft #161 wholesale.

## HTTP intent

- 201: normalized result newly created;
- 200: identical idempotent retry already exists;
- 409: same submission ID conflicts with a different normalized result;
- 400: malformed/unsupported/inconsistent/incomplete/future submission or invalid puzzle identity;
- 503: known persistence/configuration unavailability;
- 500: unexpected server fault.

All responses are `private, no-store` and expose no answer IDs/names, hints, credentials, normalized facts, or score summary.

## Acceptance checks

- malformed schema/date/ruleset/future routing is rejected before authoritative puzzle loading;
- valid Daily Nine and Classic submissions validate through engine 4A;
- client totals/unknown fields never become authority;
- created/existing/conflict semantics flow through 4B/provider without route duplication;
- no per-action write path exists;
- route response contains status/error code only;
- focused tests, typecheck, full CI, documentation-impact, preview, and exact production verification pass;
- final diff contains no browser submission code.

## Stop conditions

Stop and split if the route needs a new persistence primitive, gameplay-rule change, browser state, comparison query, rate-limit service, or account identity.
