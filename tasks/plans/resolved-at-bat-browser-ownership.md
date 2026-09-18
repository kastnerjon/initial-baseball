# Resolved-at-bat browser 6B: cross-tab ownership coordinator

Status: Implementation scope
Date: 2026-09-18

## Scope contract

Goal: provide one browser authority for a Daily Nine puzzle/ruleset so a queued tab can become owner only after the current owner releases, without activating gameplay writes or resolved-AB delivery.

Owning layer: `apps/web` browser concurrency adapter.

In scope:

- deterministic lock name keyed by stable puzzle ID/date and exact `points-v3`;
- long-lived exclusive Web Lock request held for the owner lifecycle;
- explicit `owner`, `follower`, and fail-closed `unsupported` states;
- abortable cleanup for queued requests;
- queued takeover after release with durable-state reload before owner readiness;
- generation fencing for an already-existing attempt journal while ownership is current;
- leave a missing journal missing so 6C remains the only layer deciding fresh-run creation eligibility;
- storage-event subscription as notification only, never as authority;
- stale lifecycle/reload callbacks ignored after stop/restart;
- injectable lock, storage-signal and abort-controller ports with deterministic tests;
- canonical documentation/handoff reconciliation.

Out of scope:

- creating an attempt journal;
- deciding fresh versus legacy/completion-only eligibility;
- gameplay-save writes, React hooks/components or passive-follower UI;
- reset reconciliation or interrupted gameplay/journal write recovery;
- resolved-AB POST calls/retries or completed-result ID reuse;
- server/API/Supabase changes, comparison reads/UI, IndexedDB, leases or server sessions.

## State contract

`follower` means the coordinator is active but does not hold authority. It may be queued behind another tab or still reloading durable state after lock acquisition. The tab must remain passive until `owner`.

`owner` is published only after the exclusive lock is held, any existing journal generation has been advanced and re-read successfully, and the injected durable reload callback completes. A missing journal yields `generation: null`; 6B does not create one.

`unsupported` means the browser coordination path cannot be trusted. Reasons distinguish missing Web Locks, missing abortable cleanup, journal fencing failure, durable reload failure and lock-request failure. 6C must fall back to existing non-contributing compatibility gameplay rather than inventing another authority mechanism.

Stopping a coordinator aborts a queued request and resolves the current owner's hold. Owner preparation races that release signal so a hung/stale reload cannot keep the lock indefinitely after the tab lifecycle has ended.

## Generation fencing

When an attempt journal already exists, acquisition performs:

1. read the current journal while the exclusive lock is held;
2. advance its generation exactly once;
3. re-read and verify the same attempt ID plus exactly `previous + 1`;
4. call the durable reload callback with the claimed generation;
5. publish `owner` only after reload succeeds.

Invalid/unavailable journals fail closed. A missing journal is not an error and is not created here. This preserves the 6C fresh/legacy boundary and gives 6D stale async responses a durable generation fence without a schema change.

## Storage events

Storage events are hints that durable state changed in another context. 6B forwards the key to the injected notification callback while the coordinator lifecycle is active, but the event never changes owner/follower state and never bypasses the Web Lock queue.

## End-state fit

- 6A owns durable attempt/outbox persistence and delivery metadata.
- 6B owns browser concurrency and takeover serialization.
- 6C will compose 6A + 6B with gameplay saves, fresh/legacy eligibility, reset behavior and the passive-follower experience while collection remains off.
- 6D will activate resolved-AB delivery and completed-result identity reuse, relying on 6B generation fencing for stale-response protection.

No timeout lease, clock expiry or forced steal is introduced. Physical Safari/current desktop verification remains an activation gate, not something unit tests can prove.

## Acceptance checks

- two simultaneous coordinators for one identity yield one owner and one follower;
- stopping the owner allows the queued follower to take over;
- each takeover of an existing journal advances the persisted generation exactly once;
- a missing journal remains missing and reports `generation: null`;
- owner state is not exposed until durable reload finishes;
- stopping during a pending reload releases the lock and a later stale callback cannot restore ownership;
- storage signals notify but do not confer authority;
- missing Web Locks/abort support or unsafe journal fencing fails closed;
- focused web tests plus repository typecheck/test/file-size/documentation checks pass;
- no React, gameplay, network or server path is activated.

## Stop conditions

Stop and split before adding leases, IndexedDB, server sessions, progression-token authority, gameplay mutations, attempt-creation policy, React integration, resolved-AB network activation or any product-rule change.
