# Resolved-at-bat browser lifecycle

Status: Approved architecture; 6A–6D merged and normal-path production/device proof complete; review R1–R6 repaired
Date: 2026-09-18
Review update: 2026-09-20 — see `docs/engineering/resolved-at-bat-review-2026-09-19.md`. R1–R4 repair owner/request/persistence authority, R5 adds bounded owner-scoped pending delivery recovery, and R6 makes malformed saved-state decoding fail safely. Comparison reads/UI remain separate from persistence; R7 module-boundary work and R8 write-admission/observability remain separate follow-ups.

## Scope contract for this planning PR

Goal: settle the browser ownership/durability architecture and divide implementation into independently reviewable concerns without activating collection.

Owning layer: repository product/architecture documentation.

In scope: audit the current gameplay save and completed-result client, select the cross-tab authority, define the durable record/state transitions, settle fresh/reset/legacy/fallback behavior, split implementation, and reconcile canonical docs/handoff/todo.

Out of scope: runtime source, tests, storage writes, Web Lock calls, API requests, schema changes, comparison reads/UI and production activation.

Acceptance: canonical docs agree on the mechanism and exact next PR; no document implies collection is live; documentation-impact, links, whitespace and one bounded architecture review pass.

Stop conditions: any server session, IndexedDB migration, progression-token change, account identity or product-rule change requires a separate decision rather than expansion of this planning PR.

## Goal

Activate resolved-at-bat collection only after the browser can maintain one coherent contributing Daily Nine run across refresh, reset, failures and multiple tabs. Every terminal observation must be frozen durably before its first POST and retried without changing identity or facts.

## Owning layer

Web browser adapters and React/game composition. Shared transport, engine validation/scoring, Daily idempotency and the Supabase provider remain unchanged.

## Why this is separate from the POST API

The server already makes each `(attemptId, puzzleId, rulesetVersion, pitchNumber)` row first-write-wins. That prevents overwrite of one row; it does not stop two tabs from creating different attempts or mixing gameplay facts into one run.

The current gameplay save and completed-result delivery record both use `localStorage`. Individual storage writes are synchronous, but a cross-tab read/modify/write sequence is not a transaction or lock. Storage events are notification only. Browser collection therefore stays inactive until one tab owns the contributing run and every takeover reloads durable state.

## Settled mechanism

Use one long-lived exclusive Web Lock per stable puzzle + exact ruleset while a supported tab owns the run. Keep the small durable journal/outbox in `localStorage`, alongside but separate from the gameplay save and completed-result record.

- The lock is authority; a storage event is never authority.
- The owner alone may persist the shared gameplay save, create/retire an attempt, append observations or mutate outbox delivery status.
- A non-owner tab is passive: it shows that this Daily is active in another tab, exposes no gameplay actions, and cannot write the shared save or create any contribution.
- A queued tab may become owner only after the prior lock is released. It must discard its in-memory branch and reload the persisted gameplay save and journal before enabling persistence or contribution.
- Do not use timeout leases, clock-based expiry or forced lock stealing. A backgrounded but live owner remains owner; closing/crashing it releases browser ownership.
- If Web Locks or abortable queued-lock cleanup are unavailable, gameplay retains the explicit pre-existing compatibility behavior and new resolved-AB contribution fails closed.
- If a supported tab holds the Web Lock but journal/generation handling fails, it remains the only gameplay writer for that owner lifetime while resolved-AB contribution is disabled; storage recovery does not silently re-enable contribution mid-lifetime.
- If durable owner reload fails after lock acquisition, the tab retains exclusion but exposes no writable gameplay state until its lifecycle ends. An unexpected lock-request failure is likewise non-writable.
- Feature detection plus physical iPhone/iPad Safari and current desktop browser verification is required before activation. Do not infer support from TypeScript or emulation alone.

This is narrower than adding IndexedDB or a server session table. Revisit storage only if implementation or device testing disproves the assumptions above.

## Durable record

Use a separate versioned namespace keyed by stable puzzle ID/date and exact `points-v3` ruleset. The record owns browser contribution bookkeeping, not portable gameplay state.

Conceptual schema:

```text
version: 1
identity: puzzle ID/date/number + points-v3
attemptId: one random schema-valid ID
contributionState: active | retired
generation: monotonic ownership fencing value
observations[pitchNumber]:
  submission: exact immutable schema-1 DailyAtBatResultSubmission
  delivery: pending | submitted | conflict | rejected
```

Rules:

- create and persist the attempt for a newly eligible run before its first possible observation;
- never replace an attempt ID or an observation payload in place;
- write the exact submission before starting its POST;
- compare attempt, slot, generation and stored payload before applying an asynchronous terminal response;
- `201`/`200` acknowledge the observation, `409` is terminal conflict, ordinary invalid `4xx` is terminal rejected, and network/408/425/429/5xx remains pending;
- conflict or rejection retires creation of further observations for that run; pending immutable entries remain retryable;
- transient failures never block reveal, Next At Bat, completion or sharing;
- retry pending entries once on eligible hydration/ownership acquisition and on explicit new delivery opportunities, with no timer loop or repeated full-page scanning;
- storage loss cannot be recovered without accounts and must not be described as universal exactly-once participation.

## Cross-record write ordering and crash reconciliation

The gameplay save and attempt journal intentionally remain separate records, so there is no atomic transaction across them. Owner serialization prevents tab races, but crash safety still requires one explicit order:

1. For a terminal AB, persist the updated gameplay snapshot including `pendingAdvance`, progression token and native facts.
2. Only after that write succeeds, append the exact immutable observation to the journal.
3. Only after the journal write succeeds, start the asynchronous POST.

If the gameplay write fails, do not append or send. If the journal write fails after gameplay persistence, mark the current page non-contributing and do not send. On later hydration, a gameplay save whose native terminal facts are ahead of or inconsistent with its active journal retires new contribution; it is never backfilled from saved gameplay.

Reset uses the opposite safety edge: after any observation exists, retire the journal first and clear gameplay second. A crash between those writes can leave the old game visible, but it cannot revive contribution. Fresh initialization persists the new journal before the initial gameplay save; an empty active journal with no progressed save is safe to resume.

These orderings choose possible anonymous undercount after a storage/crash fault over duplicate, forked or reconstructed observations. No code may hide the two-record boundary behind a function name that implies database-style atomicity.

## Fresh, legacy and reset policy

- A genuinely fresh `points-v3` run with no prior gameplay save may create a new attempt after ownership and durable-write checks pass.
- A pre-rollout save without the new journal remains completion-only for that run, including an old active or completed save. Do not synthesize prior AB observations.
- Existing completed-result delivery records, especially pending records, remain byte-for-byte authoritative and continue through the existing retry path.
- A fresh contributing run should reuse its attempt ID as the completed-result `submissionId` only when no completed-result record already exists. Never replace an existing completed-result identity or payload.
- Reset before any observation is recorded may keep the same active attempt.
- Reset after any observation is recorded retires the attempt for new contributions. Preserve and retry its existing outbox; replay is non-contributing even if no POST was acknowledged.
- A conflict/rejected outbox entry also retires new contribution rather than rotating identity.
- A new puzzle/ruleset receives a separate namespace and lock.

## Cross-tab state transitions

1. A tab loads gameplay and requests the named exclusive lock.
2. On acquisition it reads the gameplay save, journal and completed-result record again while ownership is current.
3. If the durable state is eligible and fresh, it creates the attempt journal before enabling contribution.
4. Only the owner persists gameplay and freezes terminal AB facts using the ordered save → journal → POST commit above.
5. Other tabs remain passive followers. They cannot mutate gameplay, persist or contribute from their local branch.
6. On owner unload/crash/release, the next queued tab acquires the lock, increments the journal generation and rehydrates from storage before acting.
7. Any old asynchronous response that no longer holds the matching ownership generation is ignored locally; the next owner may safely retry the same pending payload.

## Modular implementation sequence

### 6A. Durable attempt journal and AB outbox client

Status: Implemented; scope and acceptance contract: `tasks/plans/resolved-at-bat-browser-outbox.md`.

Owning concern: browser persistence/delivery adapter.

In scope:

- versioned codec and storage key;
- explicit journal state transitions;
- immutable slot append and reset retirement;
- exact-payload POST/retry classification;
- stale-response compare-before-write;
- injected storage, ID and request ports with focused tests.

Out of scope: Web Locks, React, gameplay saves, completed-result changes, comparison reads and live activation.

### 6B. Cross-tab ownership coordinator

Status: Implemented; scope and acceptance contract: `tasks/plans/resolved-at-bat-browser-ownership.md`.

Owning concern: browser concurrency adapter.

In scope:

- named exclusive Web Lock acquisition and release;
- owner/follower/unsupported states;
- queued takeover with durable reload callback;
- generation fencing and cleanup;
- storage-event notification only;
- deterministic injected-lock tests for simultaneous initialization, release/takeover, stale callbacks and unsupported browsers.

Out of scope: gameplay mutation, HTTP delivery, UI comparisons and server/session infrastructure.

### 6C. Gameplay lifecycle integration, collection still off

Status: Implemented; scope and acceptance contract: `tasks/plans/resolved-at-bat-browser-gameplay-lifecycle.md`.

Owning concern: React/save composition.

In scope:

- gate shared gameplay-save writes on ownership;
- establish attempts only for genuinely fresh eligible points-v3 runs;
- keep pre-rollout saves completion-only;
- reload persisted gameplay/journal state on takeover;
- apply reset-before/after-observation policy;
- reconcile gameplay/journal mismatches after interrupted cross-record writes without backfill;
- prevent followers/retired replays from creating completed-result contributions;
- add multi-instance integration tests and a minimal passive-follower state explaining that the run is active in another tab.

Out of scope: resolved-AB POST calls, comparison reads/UI, server changes and Classic AB collection.

### 6D. Delivery activation and identity unification

Status: Complete and browser-proven in production. Exact deployment/database first-write proof, physical current-browser owner/follower/takeover, fresh completed-result ID reuse, physical Safari restore, exact cleanup, and post-proof runtime health are verified. Verification record: `docs/operations/resolved-at-bat-browser-proof.md`. Scope: `tasks/plans/resolved-at-bat-browser-6d.md`.

Owning concern: resolved-AB browser activation.

In scope:

- freeze each native terminal AB into the outbox before its first send;
- asynchronously call `POST /api/daily/at-bats` without blocking gameplay;
- retry persisted pending entries after ownership/hydration;
- use the fresh run attempt ID for a new completed-result record while preserving any existing record unchanged;
- stale-resolution/reset/offline/refresh/end-of-game integration tests;
- interrupted save-before-journal and retire-before-clear crash-window tests;
- physical multi-tab/mobile verification and one controlled production insert/retry/readback proof.

Out of scope: comparison read contracts, averages, UI, background workers, accounts and stronger anti-cheat.

## Acceptance matrix

- Two tabs initialize simultaneously: one contributing owner and one follower; one durable attempt ID.
- Owner resolves an AB while follower has stale state: one immutable observation from the owner only.
- Owner closes: follower acquires, discards its branch and restores the persisted run before continuing.
- Old network response arrives after release/takeover: no stale local status overwrite; exact payload can retry.
- Refresh/offline/transient server failure: same attempt and exact payload retry.
- Crash/write failure between gameplay save and journal append: no POST or synthesized backfill; contribution retires on reconciliation.
- Crash between journal retirement and gameplay clear: replay remains non-contributing.
- Reset before first terminal AB: eligibility may remain on the same attempt.
- Reset after local observation creation, before or after acknowledgment: replay is non-contributing and original pending data survives.
- Pre-rollout active/completed/compatibility saves: no fabricated ABs; existing completion-only behavior remains.
- Existing pending completed-result record: unchanged ID/payload and independent retry.
- Missing Web Locks/abort capability: no AB contribution; gameplay retains the explicit existing compatibility behavior.
- Corrupt/unavailable journal or generation write under a held lock: one exclusive non-contributing gameplay owner; queued tabs remain followers.
- Owner durable-reload or unexpected lock-request failure: no shared gameplay write or completion creation from that blocked state; reload failure retains the acquired lock until cleanup.
- Missing secure random ID after otherwise valid ownership: gameplay remains owner-exclusive while attempt creation/contribution fails closed.
- Daily Nine and Classic saves/completed results remain isolated; Classic gains no AB collection.
- Hidden answers, answer names, search terms and wrong-player identities never enter the journal or request.

## Stop conditions

Stop and split before changing the server schema/API, progression-token authority, portable game state, Classic comparison, aggregate reads, UI comparison, account identity or adding IndexedDB/server sessions. Stop activation if real Safari/device testing cannot demonstrate exclusive ownership and safe takeover.
