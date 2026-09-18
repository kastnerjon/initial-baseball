# Completed-result browser submission client

Status: Active scope contract  
Date: 2026-09-17

## Goal

Implement the browser-side idempotent submission adapter over the merged completed-result POST API without yet wiring gameplay completion to call it.

## Owning layer

Web browser adapter.

## Architecture check

- Engine remains the only gameplay/scoring/completion authority.
- The POST API remains the server-authoritative puzzle/validation boundary.
- Daily 4B/provider remain the persistence/idempotency authority.
- This client owns only local retry bookkeeping and HTTP invocation.
- React/gameplay integration and native-fact provenance remain a separate activation PR.

## In scope

- local marker keyed by puzzle identity plus exact ruleset/game;
- persist one submission ID before first POST;
- reuse the same ID across transient/network/5xx retries;
- one in-flight POST per game identity in the current tab;
- 2xx => submitted, 409 => terminal conflict, ordinary 4xx => terminal rejected;
- clear/reset support;
- compare-before-write after POST completion so stale responses cannot recreate a cleared marker or overwrite a newer marker;
- preserve shorter Classic faced-at-bat lists;
- reject compatibility rulesets locally;
- focused adapter tests;
- roadmap/architecture/data-model/API documentation that this adapter exists but is not yet activated.

## Out of scope

- React hooks or Daily game integration;
- save provenance;
- automatic submission after completion;
- comparison/aggregate reads or UI;
- server/API/provider contract changes;
- rate limiting, accounts, archive/history, service workers, queues, polling, or background retries.

## Acceptance checks

- ID is stored before network call;
- concurrent same-game calls share one request;
- transient failure retries with same ID;
- reset during in-flight request leaves marker cleared after stale response;
- old response cannot overwrite a new post-reset marker;
- Classic shorter facts are preserved;
- unsupported compatibility rulesets do not submit;
- full CI/documentation-impact/preview pass;
- final source/test scope remains below the repo decomposition threshold.

## Stop conditions

Stop and split if activation requires gameplay state/provenance changes or if adapter design requires a server-contract change.
