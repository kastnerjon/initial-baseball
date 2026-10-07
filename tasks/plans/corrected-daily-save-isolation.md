# Corrected Daily save isolation

Status: bounded review findings addressed; final-head release gates pending

## Scope contract

**Goal:** Ensure a same-day editorial puzzle identity correction does not cause an old same-date points-v4 browser save to suppress resolved-at-bat contribution for the corrected puzzle.

**Owning layer:** `apps/web/app/dailyModeStorage.ts`.

**In scope:** Puzzle-ID-scoped current points-v4 gameplay storage, backward-compatible read fallback for a matching pre-scoped points-v4 save, reset behavior for that fallback, focused storage regressions, and canonical documentation.

**Out of scope:** Result-schema changes, server reconstruction of browser at-bats, scoring changes, archive storage, Classic storage, ownership/journal identity changes, or generic localStorage migration machinery.

**Acceptance checks:** Existing same-puzzle points-v4 progress remains restorable; a different same-date puzzle ID cannot see the prior puzzle save; current journal/outbox keys remain unchanged; focused/full CI and exact-head Vercel Preview pass.

**Stop conditions:** Any need to weaken durable mismatch safeguards, merge old/new puzzle facts, or alter archive/permanent save semantics.

## Review disposition

The one hosted review of `685d8fe` found two in-scope issues. Preserve malformed/unidentified legacy values as persisted/unusable so a missing journal cannot mint a duplicate contributing attempt; ignore only successfully identified other-puzzle state. Reconcile the canonical blueprint, architecture, data-model, API and handoff storage sections. Focused regressions cover the real contribution lifecycle, explicit reset, next-date isolation and bookkeeping-key passthrough. No scoring, schema, journal, lock or outbox change.
