# Completed-result browser submission client

Status: Active scope contract  
Date: 2026-09-17

## Goal

Implement the browser-side idempotent completed-result delivery adapter over the merged POST API without yet wiring gameplay completion to call it.

## Owning layer

Web browser adapter.

## Architecture check

- Engine remains the gameplay/scoring/completion authority.
- The POST API remains the server-authoritative puzzle/result-validation boundary.
- Daily 4B/provider remain the first-write-wins persistence/idempotency authority.
- This client owns only browser-local delivery bookkeeping and HTTP invocation.
- React/game integration, native-fact provenance, and reset policy remain the separate activation PR.

## In scope

- browser-local record keyed by stable puzzle identity plus exact ruleset/game;
- persist the **exact immutable schema-1 submission payload** before the first POST, including one stable client-generated submission ID;
- every retry reuses that exact stored payload, so one ID cannot drift across replay facts;
- explicit `allowCreate` boundary so activation code can retry an existing pending record without retroactively creating one;
- network failure plus HTTP 408/425/429/5xx remain retryable/pending;
- 2xx => submitted, 409 => terminal conflict, other ordinary 4xx => terminal rejected;
- one in-flight request per puzzle/ruleset identity in the current tab;
- compare-before-write using the current stored submission ID before applying an async terminal response;
- preserve shorter Classic faced-at-bat lists;
- reject unsupported compatibility rulesets locally;
- focused client tests plus API/data-model/architecture/handoff documentation.

## Out of scope

- React hook or Daily game integration;
- deciding when native gameplay is eligible to create a record;
- save hydration provenance;
- gameplay reset behavior;
- aggregate/comparison reads or UI;
- server/API/schema changes;
- accounts/cross-device identity;
- stronger anti-cheat;
- background retry timers/queues/service workers;
- archive/history.

## Acceptance checks

- the exact payload exists in storage before the request starts;
- retry after failure uses the same ID and the same stored facts even if the caller supplies changed replay facts;
- `allowCreate=false` with no record returns `not_started` and never mints an ID;
- an existing pending record may retry with `allowCreate=false`;
- concurrent same-identity calls share one in-flight request;
- retryable HTTP statuses remain pending;
- conflict/rejected/success states become terminal and are not reposted;
- a stale async response cannot overwrite a different stored submission ID;
- Classic shorter fact lists survive unchanged;
- compatibility rulesets never POST;
- source/test scope remains under the repo decomposition threshold;
- focused/full CI, documentation-impact, and exact-head Vercel preview pass.

## Stop conditions

Stop and split if implementation requires React/game state, save migration/provenance, server contract changes, aggregate reads, account identity, or a generalized retry worker.
