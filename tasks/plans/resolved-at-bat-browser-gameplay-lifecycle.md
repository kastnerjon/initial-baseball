# Resolved-at-bat browser 6C: gameplay lifecycle integration

Status: Implementation scope
Date: 2026-09-18

## Scope contract

Goal: compose the existing 6A journal/outbox and 6B ownership coordinator with Daily Nine gameplay persistence so only one supported tab may mutate the shared points-v3 run, fresh/legacy/reset behavior is durable and fail-closed, and resolved-AB collection remains inactive.

Owning layer: `apps/web` React/save composition.

In scope:

- gate points-v3 gameplay-save writes on 6B ownership;
- keep Classic and non-points-v3 compatibility saves on existing behavior;
- create a 6A attempt only for a genuinely fresh owned points-v3 run with no prior gameplay save;
- create the journal before the first gameplay save;
- keep a pre-rollout points-v3 save with no journal completion-only; never synthesize prior AB observations;
- on takeover, reload gameplay and journal while ownership is current before exposing interactive owner state;
- reconcile persisted native terminal facts against immutable journal observations; mismatch retires contribution instead of backfilling;
- preserve an empty active journal across takeover before the first gameplay save;
- reset with no observations may keep the same active attempt;
- reset after an observation retires the journal before clearing gameplay;
- a gameplay-save failure retires the current contributing session locally while gameplay continues;
- followers are passive and cannot write the shared save or create a completed-result contribution;
- retired/mismatched replays cannot create new completed-result contributions;
- existing completed-result records remain retryable because retry does not require new-record eligibility;
- unsupported browsers preserve existing gameplay/completed-result compatibility behavior while resolved-AB contribution fails closed;
- add a minimal passive-follower screen and focused lifecycle/persistence tests;
- keep the game component under the repository 500-line limit by moving ownership/persistence orchestration into a concrete hook;
- reconcile canonical docs/handoff/todo.

Out of scope:

- appending terminal AB observations to the journal;
- calling or retrying `POST /api/daily/at-bats`;
- reusing the attempt ID as a completed-result submission ID;
- comparison reads/UI;
- server/API/Supabase changes;
- Classic resolved-AB collection;
- leases, forced lock stealing, IndexedDB, accounts or server sessions;
- changing progression-token authority or portable gameplay rules.

## Lifecycle classification

### Fresh owned points-v3 run

If the gameplay storage key is truly absent and no journal exists under ownership, create and persist the journal first. An unreadable/corrupt persisted value is not treated as missing. Only after preparation returns may the owner autosave the initial gameplay snapshot. If secure random ID creation or journal persistence fails, gameplay remains usable but the session is non-contributing.

### Pre-rollout save

A compatible points-v3 save without a journal remains completion-only. The run may continue and retain the existing completed-result eligibility rules, but no AB attempt is synthesized and reset does not silently promote that browser session into a resolved-AB contributor.

### Existing journal

An existing active journal is usable only when its generation matches the 6B ownership claim and its immutable observations exactly match the persisted native terminal facts. The persisted terminal fact set is the pending-advance fact list when a terminal result is awaiting Next At Bat, otherwise the game state's completed-at-bat list.

Any missing/reconstructed/inconsistent facts retire contribution. No saved gameplay fact is copied into the journal.

### Reset

- Active journal with zero observations: keep the same attempt, retire nothing, clear gameplay, then allow the owner to persist the fresh UI state.
- Active journal with any observation: retire journal first, then clear gameplay; replay remains non-contributing.
- Already retired/mismatched/save-failed runs stay non-contributing.
- Legacy completion-only or attempt-ID-unavailable sessions may keep existing completed-result replay behavior but never become resolved-AB contributors in the same mounted lifecycle.

### Completed-result interaction

The existing completed-result retry path remains independent. New-record creation is allowed only when the current gameplay lifecycle says so. A follower or retired/mismatched run cannot create a new completed-result record, but an existing pending record can still retry after the tab becomes the durable owner or through compatibility behavior.

6D will unify a fresh contributing run's attempt ID with a new completed-result record. 6C deliberately does not change that identity yet.

## End-state fit

- 6A owns durable attempt/outbox facts.
- 6B owns browser authority and generation fencing.
- 6C owns gameplay/save composition and contribution eligibility.
- 6D will add the final commit edge: gameplay save succeeds → freeze immutable terminal AB → asynchronous delivery, plus completion-ID reuse and production/device proof.

This split keeps resolved-AB networking out of the gameplay critical path until the browser state machine is already coherent.

## Acceptance checks

- fresh owner with a truly absent gameplay key creates exactly one attempt before the initial save;
- an unusable/corrupt persisted gameplay value never mints a resolved-AB attempt;
- pre-rollout save without journal never creates an attempt;
- takeover before the first gameplay save preserves the empty journal;
- exact journal/gameplay facts remain contributing;
- gameplay ahead of or inconsistent with journal retires without backfill;
- reset with empty journal preserves the attempt;
- reset with observations retires before gameplay clear;
- failed gameplay persistence retires contribution without blocking UI;
- supported follower renders passive state and performs no shared save;
- unsupported/Classic/older-rule sessions retain existing compatibility persistence;
- completed-result creation is disabled for followers and retired/mismatched replays while retry semantics remain untouched;
- no resolved-AB POST is introduced;
- `DailyInningGame.tsx` remains at or below 500 lines;
- focused tests plus full typecheck/test/file-size/docs/build checks pass.

## Stop conditions

Stop and split before adding resolved-AB delivery, completed-result identity reuse, server/storage infrastructure, Classic AB collection, aggregate reads/UI, progression-token changes or any product-rule change.
