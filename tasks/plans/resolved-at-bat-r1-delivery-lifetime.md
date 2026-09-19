# Resolved-at-bat R1 — owner delivery lifetime

Status: implemented; verification pending on the repair PR  
Date: 2026-09-19

## Scope contract

- **Goal:** once a Daily Nine browser owner loses authority, that old owner cannot start another resolved-AB retry or mutate local delivery acknowledgment state.
- **Owning layer:** `apps/web` browser delivery adapter and persistence-hook composition.
- **In scope:** bind AB delivery to one durable attempt ID/generation; synchronously dispose that delivery lifetime before Web Lock release; stop queued retries after disposal; make late success/error callbacks locally inert; add deterministic takeover/interleaving regressions; reconcile handoff/architecture/todo.
- **Out of scope:** retry scheduling/recovery policy (R5), gameplay Guess/Give Up lifetime (R2), journal-failure shared-write authority (R3), React re-bootstrap authority (R4), schema, scoring, provider/API behavior, comparison reads/UI, leases or forced takeover.
- **Acceptance checks:** old owner starts no second queued retry after disposal; late terminal or network-error completion does not update journal delivery state; a successor-generation append survives; immutable pending payloads remain retryable; a legitimate successor owner can retry them; focused web tests plus repository typecheck/test/file-size/build gates.
- **Stop conditions:** any fix requiring a new persistence mechanism, schema/provider change, retry scheduler, ownership lease, scoring change, or product fallback decision.

## Implementation

`dailyAtBatResultClient` exposes an owner-scoped delivery session instead of unscoped send/retry methods. Creation snapshots the currently durable `attemptId` and `generation`. Every send revalidates that exact pair; disposal makes the capability stale. Retry iteration checks disposal between awaited slots, and late request completion checks the same owner lifetime before any journal acknowledgment mutation.

`useDailyGameplayPersistence` holds exactly one such delivery session for the current owner. It disposes/replaces that session on authority changes and, critically, disposes it synchronously in effect cleanup before `coordinator.stop()` releases the Web Lock. New terminal deliveries must match the current active contribution attempt/generation.

This repairs R1 only. R2 is the next runtime concern.
