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

- add a local submission record keyed by stable puzzle identity plus exact ruleset/game;
- persist the **exact immutable schema-1 submission payload**, including one valid random submission ID, before the first POST;
- retry transient/network/408/425/429/5xx failures using that exact stored payload so one ID can never drift across replay facts;
- treat 2xx as submitted, 409 as terminal conflict, and other ordinary 4xx as terminal rejected;
- prevent duplicate concurrent POSTs for the same current game identity in one tab;
- after a POST settles, compare the current stored submission ID before writing status so a stale async response cannot overwrite changed/cleared transport state;
- expose local-only native-fact provenance from Daily save hydration so compatibility-reconstructed completed at-bats are never submitted;
- permit marker creation only for a completion reached natively in the current compatible session, while allowing an already-persisted pending marker to retry after refresh;
- keep result-delivery bookkeeping across `Reset today's local result`: a server aggregate row cannot be un-submitted, and clearing the marker would allow duplicate browser contributions on replay;
- focused browser-client, save-provenance, and integration tests;
- update API/browser-persistence/data-model/architecture/START-HERE/todo documentation.

## Out of scope

- aggregate/comparison reads or UI;
- submission status UI/toasts;
- background timers, polling, service workers, or queues;
- retroactively submitting already-completed saves that predate result-delivery bookkeeping;
- accounts/cross-device identity;
- stronger anti-cheat/session proof;
- per-action writes;
- rate-limit infrastructure;
- archive/history;
- changing POST/4A/4B/provider contracts.

## Acceptance checks

- supported native completion creates exactly one persisted payload/ID before request;
- repeat effects and concurrent calls share one in-flight request;
- refresh retries the exact same pending payload and ID;
- transient/network/408/425/429/5xx failures remain pending;
- 2xx, 409, and other ordinary 4xx become terminal local statuses;
- reset does not clear/re-mint aggregate identity, so replay cannot create a second browser contribution for the same puzzle/ruleset;
- stale async responses update status only when their stored submission ID still owns the marker;
- compatibility-reconstructed facts and pre-feature completed saves without a marker never call the result endpoint;
- Classic shorter faced-at-bat lists submit intact;
- no result write occurs before terminal completion;
- docs distinguish local retry bookkeeping from gameplay state and global analytics;
- full CI, documentation-impact, preview, and production verification pass.

## Stop conditions

Stop and split if this requires server contract changes, aggregate reads, gameplay-rule changes, a new browser persistence framework, or user/account identity.
