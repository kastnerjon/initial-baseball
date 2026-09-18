# Completed-result browser submission and retry

Status: Active scope contract  
Date: 2026-09-17

## Goal

Activate completion-only anonymous result submission from the browser using the merged POST API, with one stable client submission ID, idempotent retries, native-fact provenance gating, and reset/in-flight race safety.

## Owning layer

Web browser adapter / React integration.

## Architecture check

- Engine still owns gameplay rules, completion, and normalized result derivation.
- The POST API still owns authoritative puzzle lookup and server validation.
- The Daily 4B service/provider still owns first-write-wins interpretation and persistence.
- Browser code only decides when a native completed game is eligible to submit, persists retry bookkeeping, and calls the POST endpoint.
- No scoring, puzzle validation, aggregate semantics, or Supabase access belongs in the browser adapter.

## In scope

- add a local submission marker keyed by stable puzzle identity plus exact ruleset/game;
- persist one valid random submission ID before the first POST;
- retry transient/network/5xx failures with the same stored ID;
- treat 2xx as submitted, 409 as terminal conflict, and ordinary 4xx as terminal rejected;
- prevent duplicate concurrent POSTs for the same current game identity in one tab;
- after a POST settles, compare the current stored marker before writing status so reset/new replay cannot be overwritten by a stale response;
- expose local-only native-fact provenance from Daily save hydration so compatibility-reconstructed completed at-bats are never submitted;
- wire the submission effect only after saved-state hydration and genuine native completion for `points-v3` or `classic-inning-v1`;
- reset clears only the current game/ruleset submission marker and invalidates any stale in-flight completion response;
- focused browser-client, save-provenance, and integration tests;
- update API/browser-persistence/data-model/architecture/START-HERE/todo documentation.

## Out of scope

- aggregate/comparison reads or UI;
- submission status UI/toasts;
- background timers, polling, service workers, or queues;
- accounts/cross-device identity;
- stronger anti-cheat/session proof;
- per-action writes;
- rate-limit infrastructure;
- archive/history;
- changing POST/4A/4B/provider contracts.

## Acceptance checks

- supported native completion creates exactly one marker/ID before request;
- repeat effects and concurrent calls share one in-flight request;
- refresh retries pending marker with the same ID;
- transient/network/5xx failures remain pending;
- 2xx, 409, and ordinary 4xx become terminal local statuses;
- reset during an in-flight POST removes the marker and stale completion cannot recreate it;
- a new marker/ID created after reset cannot be overwritten by an older request;
- compatibility-reconstructed facts never call the result endpoint;
- Classic shorter faced-at-bat lists submit intact;
- no result write occurs before terminal completion;
- docs distinguish local retry bookkeeping from gameplay state and global analytics;
- full CI, documentation-impact, preview, and production verification pass.

## Stop conditions

Stop and split if this requires server contract changes, aggregate reads, gameplay-rule changes, a new browser persistence framework, or user/account identity.
