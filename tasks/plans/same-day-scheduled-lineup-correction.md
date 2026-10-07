# Same-day scheduled lineup correction

Status: merged and production verified

## Scope contract

**Goal:** Allow one explicitly authorized same-day correction of an already scheduled Daily lineup without exposing a draft fallback or mixing result populations.

**Owning layer:** `packages/daily` lifecycle behavior, transported by the existing web ChatOps adapter.

**In scope:** An atomic scheduled-lineup correction, same-day ChatOps gating, focused lifecycle/workflow tests, and canonical operational/runtime documentation.

**Out of scope:** Published or archived puzzle mutation, direct database writes, result deletion or migration, automatic correction, archive behavior, scoring, UI changes, or broader admin redesign.

**Acceptance checks:** Focused tests, full repository CI, exact-head Vercel Preview, authoritative Supabase readback, then post-merge production verification.

**Stop conditions:** Any requirement to mutate a published/archived puzzle, rewrite prior result rows, or weaken existing identity, auth, publication, or comparison boundaries.

## October 6 operational outcome

#305 merged as `c01c23bb851f3ea66e6b4dd3f95c48a23302a126`; push CI #1046 passed and exact production `dpl_13SpUzPznbEUphP5DiPU1dTf99rj` was READY. Private ChatOps corrected only slot 5 to Tim Raines Sr. while the row remained scheduled, revision 10. The ordered identity changed from `daily-2026-10-06-editorial-eb79edef` to `daily-2026-10-06-editorial-6aee324e`; unchanged selections and original result rows remain intact. No published/archived record was mutated.

The owner separately requested an exceptional beta data copy with synthetic replacement-slot scores; that operation was outside #305's code scope and is documented explicitly in START-HERE. It is not an automatic correction lifecycle. The concrete browser addressing defect uncovered afterward was fixed in #306; production and tomorrow's unaffected scheduled-lineup evidence live in `tasks/plans/corrected-daily-save-isolation.md`.
