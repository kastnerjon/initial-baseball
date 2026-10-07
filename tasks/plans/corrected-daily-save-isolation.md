# Corrected Daily save isolation

Status: merged and production verified

## Scope contract

**Goal:** Ensure a same-day editorial puzzle identity correction does not cause an old same-date points-v4 browser save to suppress resolved-at-bat contribution for the corrected puzzle.

**Owning layer:** `apps/web/app/dailyModeStorage.ts`.

**In scope:** Puzzle-ID-scoped current points-v4 gameplay storage, backward-compatible read fallback for a matching pre-scoped points-v4 save, reset behavior for that fallback, focused storage regressions, and canonical documentation.

**Out of scope:** Result-schema changes, server reconstruction of browser at-bats, scoring changes, archive storage, Classic storage, ownership/journal identity changes, or generic localStorage migration machinery.

**Acceptance checks:** Existing same-puzzle points-v4 progress remains restorable; a different same-date puzzle ID cannot see the prior puzzle save; current journal/outbox keys remain unchanged; focused/full CI and exact-head Vercel Preview pass.

**Stop conditions:** Any need to weaken durable mismatch safeguards, merge old/new puzzle facts, or alter archive/permanent save semantics.

## Review disposition

The one hosted review of `685d8fe` found two in-scope issues. Preserve malformed/unidentified legacy values as persisted/unusable so a missing journal cannot mint a duplicate contributing attempt; ignore only successfully identified other-puzzle state. Reconcile the canonical blueprint, architecture, data-model, API and handoff storage sections. Focused regressions cover the real contribution lifecycle, explicit reset, next-date isolation and bookkeeping-key passthrough. No scoring, schema, journal, lock or outbox change.

## Production checkpoint scope contract

**Goal:** Record the verified correction/save-isolation release so the next conversation resumes ordinary Daily operation and the approved archive work accurately.

**Owning layer:** repository documentation only.

**In scope:** START-HERE, todo and the two existing correction plans; exact review/CI/deployment evidence, read-only lineup/result checks, explicit seeded-data provenance and remaining verification limits.

**Out of scope:** runtime code, scoring, schemas, additional database repair, future lineup changes, archive activation or a new migration framework.

**Acceptance checks:** compare each statement with observed GitHub/Vercel/Supabase evidence; documentation gate and whitespace; one bounded review; exact-head CI/READY Preview; post-merge main/push CI/production/routes/log checks.

**Stop condition:** a new behavior, data mutation or product decision requires separate work.

## Verified release evidence — October 6 Pacific date

- Final head `2d3891840ccea15666c42258ee18fa2e4da7b668`: CI #1048 (37554387969) passed both jobs; all 712 web tests, including 19 storage tests, passed. Typecheck, strict data pipeline, file-size, production build and hidden-answer QA passed. Local/remote tested tree matches `b8386496a76decb6ee374b7fc55bbf95fc75d881`.
- Exact Preview `dpl_HZQMvFcTKjRokVN1ExLQsEaFA9v8` READY; authenticated root/comparison GETs succeeded. Both findings from the single hosted review are fixed and resolved; no second full review was requested for the same runtime concern.
- Merge `858129a8edd0c497fec98d75cfa3930d8bf38b0f`; push CI #1049 (37554631250) passed. Production `dpl_HZ2Qi9NdPifybzSU2ezPLiLzSUVH` READY on that merge with the canonical alias.
- Canonical `/`, `/archive`, issued `/archive/1` returned 200; unissued `/archive/2` returned 404; hidden `/classic` redirected to `/`. Corrected v4 at-bat/completed reads returned 200 and `private, no-store`; old identity and future October 7 reads returned sanitized 404. The wrong-parameter verification probe returned 400 as expected; the corrected documented query parameters succeeded.
- Exact-deployment error/fatal scan at 01:00:42Z, more than 60 seconds after READY, was empty. Cloud Chrome reload reaches hydrated Daily #163 with live AVG cells. Browser console errors observed belong only to the browser extension, not the app.
- Read-only Supabase confirms the October 6 correction, intact original rows, owner-requested seeded rows, the recovered 13.5 game in both stores, and new native AB arrivals. A separate 36-point completed record has no corresponding AB observations at the checkpoint; this PR adds no reconstruction and did not insert/delete/update hosted data.
- October 7 #164 and October 8 #165 remain scheduled with nine distinct canonical IDs and zero results. All nine October 7 IDs resolve to approved canonical identities with Lahman source mappings. The actual date adapter maps 06:59:59Z to October 6 and 07:00:00Z to October 7: midnight Pacific / 3 AM Eastern. Storage regressions prove next-date isolation and unchanged journal/outbox addressing.

Physical-device QA and an actual post-midnight October 7 play remain future observations, not claimed test evidence. No new completed play was submitted by this verification. Normal Daily consumes the scheduled row automatically; no correction reversal, rescheduling, seed migration or manual activation is needed tomorrow.
