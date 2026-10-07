# Corrected Daily save isolation

Status: implementation complete; review and release gates pending

## Scope contract

**Goal:** Ensure a same-day editorial puzzle identity correction does not cause an old same-date points-v4 browser save to suppress resolved-at-bat contribution for the corrected puzzle.

**Owning layer:** `apps/web/app/dailyModeStorage.ts`.

**In scope:** Puzzle-ID-scoped current points-v4 gameplay storage, backward-compatible read fallback for a matching pre-scoped points-v4 save, reset behavior for that fallback, focused storage regressions, and canonical documentation.

**Out of scope:** Result-schema changes, server reconstruction of browser at-bats, scoring changes, archive storage, Classic storage, ownership/journal identity changes, or generic localStorage migration machinery.

**Acceptance checks:** Existing same-puzzle points-v4 progress remains restorable; a different same-date puzzle ID cannot see the prior puzzle save; current journal/outbox keys remain unchanged; focused/full CI and exact-head Vercel Preview pass.

**Stop conditions:** Any need to weaken durable mismatch safeguards, merge old/new puzzle facts, or alter archive/permanent save semantics.
