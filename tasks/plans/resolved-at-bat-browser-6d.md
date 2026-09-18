# Resolved-at-bat browser 6D: delivery activation and identity unification

Status: Implementation scope
Date: 2026-09-18

## Scope contract

Goal: activate Daily Nine resolved-at-bat delivery on top of the already-merged 6A durable journal, 6B exclusive ownership, and 6C gameplay lifecycle without putting network work on the gameplay critical path or changing server/storage contracts.

Owning layer: `apps/web` browser activation/composition.

In scope:

- after an owner gameplay save succeeds, freeze every currently persisted native terminal AB into the 6A journal before any first POST;
- never freeze an AB when the matching gameplay save failed;
- asynchronously deliver newly frozen/pending observations through `POST /api/daily/at-bats`;
- retry persisted pending observations after ownership/hydration without delaying owner readiness;
- keep exact stored payloads and generation fencing from 6A/6B;
- fail the local contribution session closed when freeze/delivery reaches conflict, rejection, stale or unavailable state, while leaving ordinary gameplay usable;
- use the active fresh attempt ID as the creation ID for a new points-v3 completed-result record;
- if a completed-result record already exists, preserve and retry that exact record unchanged regardless of the active AB attempt ID;
- preserve Classic and compatibility behavior with no resolved-AB collection;
- keep gameplay-save → journal-freeze → async POST ordering explicit and testable;
- document/verify the intentional crash windows:
  - save succeeds but freeze never happens: next takeover retires rather than backfills;
  - reset retires but gameplay clear never happens: later lifecycle remains retired;
- exact-head CI and Vercel preview/build verification;
- controlled production proof and browser multi-tab verification before declaring collection live;
- canonical docs/handoff/todo reconciliation.

Out of scope:

- comparison population reads, averages, finish-percentile UI or caching;
- server/API/Supabase schema changes;
- Classic resolved-at-bat collection;
- background workers, accounts, cross-device identity or stronger anti-cheat;
- progression-token changes or portable scoring/gameplay changes.

## Commit edge

For an active owner:

1. build the ordinary gameplay save from current React state;
2. persist that gameplay save;
3. only if persistence succeeded, freeze the persisted native terminal fact set into the immutable journal;
4. schedule delivery for frozen/pending slots without awaiting it;
5. if freeze or terminal delivery fails closed, disable future contribution locally but do not break gameplay.

The persisted terminal fact set remains `pendingAdvance.completedAtBats` while a terminal result awaits Next At Bat; otherwise it is `gameState.completedAtBats`.

A save failure never appends an observation. This preserves the conservative crash invariant: gameplay may be ahead of the journal, but the journal may never claim a fact that gameplay durability did not first confirm.

## Retry activation

On owner acquisition, 6C reload/reconciliation completes first and owner state becomes interactive. Pending AB delivery is then scheduled asynchronously for the current attempt/generation. Retry must not delay hydration or gameplay.

Transient network failures remain `pending`. Exact same-payload retry is safe. Conflict/rejection retires the journal under the existing 6A semantics. Stale/unavailable delivery disables the current local contribution session.

## Completed-result identity

For a fresh active points-v3 contributor, new completed-result creation uses `attemptId` as `submissionId`.

This preference applies only when the completed-result browser record is missing. If a record already exists, its frozen submission ID/payload/status are authoritative and the client ignores the preferred attempt ID. Legacy/completion-only and Classic behavior continue to generate their existing independent IDs when creating an eligible new record.

No migration rewrites historical completed-result records.

## End-state fit

After 6D:

- 6A = durable immutable observation/outbox;
- 6B = browser authority and generation fencing;
- 6C = gameplay persistence and contribution eligibility;
- 6D = save-ordered freeze/delivery activation plus fresh completion identity reuse.

Comparison reads/UI can then consume independently arriving immutable AB rows without being part of the gameplay write path.

## Acceptance checks

- failed gameplay save freezes/sends nothing;
- successful owner save freezes exact native terminal facts before scheduling delivery;
- repeated autosaves do not create new facts or duplicate network actors;
- takeover/reload retries pending immutable payloads asynchronously;
- stale old-generation responses cannot acknowledge the current generation;
- conflict/rejection/stale/unavailable disables future local contribution;
- transient network failure remains pending and replayable;
- fresh completed result uses the active attempt ID;
- existing completed-result records ignore a different preferred ID and preserve exact pending payloads;
- compatibility/Classic sessions do not send resolved ABs;
- crash-window behavior remains undercount/fail-closed rather than backfill;
- no comparison/server/schema work enters the PR;
- full CI/file-size/docs/build checks pass;
- exact-head Vercel preview is READY;
- production deployment is READY on exact merge SHA;
- browser multi-tab proof confirms one owner/follower takeover;
- one controlled production AB insert plus exact retry/readback proves first-write-wins delivery;
- runtime-error scan is clean before collection is documented live.

## Stop conditions

Stop and split before adding comparison contracts/UI, server schema/API changes, Classic AB collection, background processing, accounts, server sessions, or product-rule changes.
