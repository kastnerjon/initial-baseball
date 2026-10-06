# Same-day scheduled lineup correction

Status: implementation in progress

## Scope contract

**Goal:** Allow one explicitly authorized same-day correction of an already scheduled Daily lineup without exposing a draft fallback or mixing result populations.

**Owning layer:** `packages/daily` lifecycle behavior, transported by the existing web ChatOps adapter.

**In scope:** An atomic scheduled-lineup correction, same-day ChatOps gating, focused lifecycle/workflow tests, and canonical operational/runtime documentation.

**Out of scope:** Published or archived puzzle mutation, direct database writes, result deletion or migration, automatic correction, archive behavior, scoring, UI changes, or broader admin redesign.

**Acceptance checks:** Focused tests, full repository CI, exact-head Vercel Preview, authoritative Supabase readback, then post-merge production verification.

**Stop conditions:** Any requirement to mutate a published/archived puzzle, rewrite prior result rows, or weaken existing identity, auth, publication, or comparison boundaries.
