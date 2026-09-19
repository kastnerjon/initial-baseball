# Resolved-at-bat browser 6D: delivery activation and identity unification

Status: Complete; production deploy/database proof, real two-tab takeover, fresh completion-ID equality, physical Safari restore, cleanup, and runtime health are verified
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
- full CI/file-size/docs/build checks pass — verified on PR #185;
- exact-head Vercel preview is READY — verified before merge;
- production deployment is READY on exact merge SHA — verified: `1965258055eecbf501de82d6f0aed395aea33867` / `dpl_7Ceu1nwPYZQgUrJaPdsiBQqrLmPa`;
- one controlled production AB insert plus exact retry/readback proves first-write-wins delivery — verified: production 201 then 200, one normalized disposable row with one receipt timestamp, then cleanup;
- runtime-error scan is clean after the proof — verified for `/api/daily/at-bats` and `/api/daily/results`;
- browser multi-tab proof confirms one owner/follower takeover — verified in Chrome Incognito on a physical iPhone; exact browser version was not captured;
- fresh full-completion identity proof confirms a new completed-result `submissionId` equals the active AB `attemptId` — verified with attempt `6da8d6b7-aedd-457c-82e4-1be0b1e3ac7f`;
- physical Safari Private restore is verified on a fresh iPhone run; collection is now documented fully browser-proven for the current anonymous beta model.

## Stop conditions

Stop and split before adding comparison contracts/UI, server schema/API changes, Classic AB collection, background processing, accounts, server sessions, or product-rule changes.


## Verified production evidence — 2026-09-18

- PR #185 merged as `1965258055eecbf501de82d6f0aed395aea33867`.
- Exact production deployment `dpl_7Ceu1nwPYZQgUrJaPdsiBQqrLmPa` reached READY.
- Production runtime logs on that deployment recorded `POST /api/daily/at-bats` HTTP 201 at 23:23:48 UTC and HTTP 200 at 23:24:09 UTC for an exact retry.
- Database readback between those requests/cleanup showed one normalized row for disposable attempt `proof6d_19652580_p1`, puzzle `daily-2026-09-18-editorial-f5f968b7`, `points-v3`, pitch 1, initials `GC`, outcome `K`, resolution `give_up`, awarded points 0, receipt `2026-09-18 23:23:50.838102+00`.
- The disposable row was cleaned up; no persistent proof pollution remains.
- A post-proof runtime-error scan for the resolved-AB and completed-result routes was clean.
- Final physical-browser proof ran against production deployment `dpl_2DLJ5461tmLVVVewcVdDpezaxJtU` on main SHA `f6a88ca9f0b5c95171108c17d81e21303fca2f27`.
- Chrome Incognito on a physical iPhone (exact version not captured) showed one interactive owner and one passive follower with the expected message. After batter 1 Give Up, Supabase contained exactly one pitch-1 row under attempt `6da8d6b7-aedd-457c-82e4-1be0b1e3ac7f` and Vercel logged one HTTP 201. Closing the owner allowed the follower to take over and restore at batter 2 without creating another attempt or POST.
- Finishing the same run with Give Up on batters 2–9 produced exactly nine AB rows, pitches 1–9 once each, all under that attempt ID. Vercel logged nine total successful AB HTTP 201 responses.
- The terminal `POST /api/daily/results` returned HTTP 201 and created exactly one completed-result row whose `submission_id` was the same `6da8d6b7-aedd-457c-82e4-1be0b1e3ac7f`; its nine native facts and zero-point summary matched the AB rows.
- The post-proof runtime-error scan for `/api/daily/at-bats` and `/api/daily/results` was clean.
- A separate fresh physical iPhone Safari Private run created attempt `3d112236-c6df-4416-981b-8f193eb2ab7e`, persisted pitch 1 with HTTP 201, and restored at batter 2 after refresh; no runtime errors were found.
- Privileged cleanup deleted only those two exact disposable QA identities, including the completed-result row for the full run; authoritative readback confirmed zero remaining QA rows.
