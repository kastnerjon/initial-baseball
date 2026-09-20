# Resolved-AB pending delivery recovery

Status: Implemented, verified and merged in PR #212
Date: 2026-09-20

## Scope contract

Goal: give current-owner pending resolved-at-bat observations another bounded chance to deliver during the same play session, without creating a retry loop or blocking gameplay.
Owning layer: `apps/web` browser delivery/persistence.
In scope: finite resolved-AB POST deadline, owner-scoped older-pending retry on each newly frozen terminal AB, exact-payload/idempotency preservation, deterministic timeout/exclusion regressions, and documentation.
Out of scope: periodic timers/backoff service, online/offline listeners, old-day/global draining, comparison-read retry, completed-result retry changes, Web Lock redesign, API/schema/Supabase changes, scoring, or UI changes.
Acceptance: one never-settling pending request becomes pending again after the deadline and does not prevent later pending slots from being attempted; a later terminal AB can retry an older pending slot without immediately retrying its just-created slot; owner/generation fencing and exact stored payload reuse remain intact; full CI/build/hidden-answer QA pass.
Stop condition: if recovery requires new background scheduling, service-worker behavior, or cross-day delivery authority, stop and make that a separate architecture decision.

## Delivery policy

- Each resolved-AB POST has a 5-second browser deadline. Timeout aborts the fetch and returns the observation to the existing pending state; the browser never invents a new identity or payload.
- Owner acquisition keeps the existing full pending sweep.
- After a successful gameplay save freezes one or more new terminal observations, those new slots are sent immediately.
- That same terminal boundary also runs one pending sweep excluding the newly frozen slots. This gives older transient failures another chance without double-attempting the new slot in the same opportunity.
- The existing in-flight map single-flights the same attempt/generation/slot.
- No periodic timer, online event, background service, or historical-day scan is introduced.
- A final transient failure with no later terminal boundary remains pending until refresh/takeover/another owner acquisition. This is intentional and preserves the project's undercount-over-background-complexity tradeoff.

## Second-order effects

A hung older observation cannot indefinitely block the sequential owner-acquisition retry because the deadline advances the sweep. During ordinary play, the just-created slot starts its direct request before the older-pending sweep, so recovery work does not delay collection of the current terminal AB or any gameplay control.

Unknown-commit timeouts remain safe: the server may have committed before the client deadline, but a later exact retry resolves through the existing first-write-wins/idempotent API behavior.

R1 ownership fencing remains the correctness mechanism. Abort/timeout only bounds work; stale owner callbacks still cannot mutate the journal after ownership changes.

## Verification

Focused client regressions cover exclusion and a never-settling first request followed by a successful later slot. Existing R1 generation/disposal tests remain unchanged. PR #212 merged as `4bb66d5bb93051dfb88559cfc58a524e06824f4a`; exact-head CI and Vercel Preview passed, push CI #782 completed successfully, and production deployment `dpl_6rCfeRkUngD48ftT1FM8UgzjtCoZ` is READY on that exact runtime SHA. No Supabase migration was applicable.

## Documentation impact

Reconcile START-HERE, todo, and the September 19 resolved-at-bat review. Mark only R5 repaired; R7, R8 and interactive/mobile comparison verification remain separate.
