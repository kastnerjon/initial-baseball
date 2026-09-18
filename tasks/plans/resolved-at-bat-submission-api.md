# Resolved-at-bat submission API

Status: Implemented; browser collection inactive
Date: 2026-09-18

## Goal

Expose one anonymous server POST boundary that validates a single points-v3 terminal AB against the authoritative Daily puzzle and stores only the engine-normalized result through the merged Daily service and Supabase provider.

## Owning layer

Web API / server composition.

## Architecture check

- Engine remains the only puzzle/fact validation and awarded-points authority.
- `packages/daily` remains the only idempotency/conflict authority.
- The Supabase adapter remains a provider-only first-write-wins implementation.
- The route parses transport, calls server composition and maps a sanitized response; it does not score or interpret baseball.
- Authoritative puzzle lookup reuses the existing cached Daily runtime path without minting progression tokens or hint bundles.
- Browser attempt identity, outbox/retry, cross-tab ownership and activation remain a separate following concern.

## In scope

- preflight only routing fields required before puzzle lookup: object shape, schema version, real calendar date, points-v3 ruleset and non-future date;
- load the authoritative public puzzle for the requested date;
- call `validateDailyAtBatResult` with that puzzle and exact ruleset;
- store only a successful normalized result through `createDailyAtBatResultService` and the Supabase provider;
- add `POST /api/daily/at-bats`;
- return `private, no-store` created/existing/conflict/invalid/unavailable responses without normalized facts, points, answer data or provider detail;
- add focused submission-service and route tests;
- reconcile API, architecture, data-model, START-HERE, roadmap and todo documentation.

## Out of scope

- browser attempt ID creation, cross-tab locking, local immutable outbox, retry/backoff, reset or old-save handling;
- comparison read contracts, aggregates, freshness, caching, performance benchmarks or UI;
- Classic resolved-AB collection;
- changes to portable validation/service/provider contracts;
- rate-limit infrastructure, accounts, archive/history, receipts, progression-token changes or anti-cheat claims;
- adding the AB write to `/api/daily/resolve` or otherwise placing persistence on the gameplay-critical path.

## HTTP intent

- `201 {"status":"created"}`: first successful insert for the observation key;
- `200 {"status":"existing"}`: identical immutable retry;
- `409 {"error":"idempotency_conflict"}`: the observation key already belongs to a different normalized result;
- `400 {"error":"..."}`: malformed, unsupported, inconsistent, future or mismatched observation;
- `503 {"error":"at_bat_result_unavailable"}`: known provider/configuration unavailability;
- `500 {"error":"at_bat_result_unavailable"}`: unexpected server fault.

## Acceptance checks

- invalid schema/date/ruleset/future routing is rejected before puzzle loading;
- a valid isolated slot 1–9 validates through engine authority and stores every normalized field, including derived points;
- client points/answers/timestamps/unknown extras never become authority;
- created/existing/conflict semantics flow through Daily/provider without route duplication;
- route bodies expose status/error code only and every response is `private, no-store`;
- known lookup/provider/configuration and unexpected errors map deliberately without leaking detail;
- full tests, typecheck, lint, build, hidden-answer QA, file-size, documentation-impact and preview pass;
- final diff contains no browser activation or comparison read code.

## Stop conditions

Stop and split if the route needs a new persistence primitive, gameplay-rule change, browser state, comparison query, rate-limit service, server attempt session or account identity.
