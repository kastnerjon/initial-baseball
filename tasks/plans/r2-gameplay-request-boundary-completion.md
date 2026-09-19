# R2 gameplay request lifetime boundary completion

Status: implemented; verification pending on this PR  
Date: 2026-09-19

## Scope contract

- **Goal:** finish the original R2 acceptance criteria by invalidating in-flight Guess/Give Up authority whenever the persistence/session authority that admitted it ends, not only on Reset or durable restore.
- **Owning layer:** `apps/web` browser gameplay composition.
- **In scope:** wire the existing request controller's `invalidate()` to persistence-session teardown and owner-to-non-owner transitions; keep the callback authority-only so persistence cleanup never owns request UI state; reconcile R2 documentation.
- **Out of scope:** controller redesign, new retry behavior, R3 journal-degradation/shared-write authority, R4 stale persistence-effect authorization, engine/scoring, server/API/provider/schema changes, new test dependencies.
- **Acceptance checks:** effect cleanup invalidates request authority before coordinator release; an owner-to-follower/unsupported transition invalidates immediately; Classic/compatibility session replacement also invalidates on effect teardown; existing Reset/restore and stale-callback regression tests remain unchanged and green; full CI/Vercel pass.
- **Stop conditions:** any need to change save authorization, unsupported-mode product behavior, lock semantics, storage format, or scoring moves to R3/R4 or another explicit concern.

## Design

`DailyInningGame` passes an authority-only invalidation callback into `useDailyGameplayPersistence`. The hook stores the latest callback in a ref, invokes it during persistence-effect teardown before releasing the coordinator, and invokes it on any runtime owner-to-non-owner access transition. The callback only invalidates the request-generation controller; it does not set React state during persistence cleanup.

This closes the identity/ownership-loss part of R2. R3/R4 remain unchanged.
