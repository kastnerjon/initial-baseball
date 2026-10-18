# Hosted Custom QA runner — loopback origin alignment

## Scope contract

- Goal: Execute the real isolated Custom HTTP acceptance suite without the runner's loopback hostname being rejected by the existing strict origin check.
- Owning layer: apps/web/scripts QA tooling.
- In scope: Canonical localhost request origin matching NextRequest normalization, while preserving loopback-only server binding and production-ref exclusion; regression using the installed NextRequest; record actual hosted test evidence and operational checkpoint.
- Out of scope: Application origin/auth protections, game rules, public creation, rate controls, schema/production mutations and activation.
- Acceptance: Reproduce 127.0.0.1 → localhost normalization with actual NextRequest; focused startup guards; actual QA-only HTTP acceptance N=1–10 and alternative endings; verify counts and production unchanged; independent bounded review, exact-head CI and READY Preview.
- Stop conditions: Any runtime security weakening, production credential or fixture, or unrelated application defect requires a separate decision/PR.

## Reproduced cause

The original runner sends Origin http://127.0.0.1:PORT, while the installed NextRequest normalizes request.url to http://localhost:PORT. The unchanged admin mutation rejects the mismatch with 403 before issuing a challenge. Use localhost consistently for test requests; keep the server bound to 127.0.0.1 and the random port reservation. Do not allow null/missing Origin or relax application checks to make a test pass.

## Actual hosted evidence — October 18, 2026

Application baseline: bb952dc38808f8079d909c1e802a8730b6300dfd, with this runner-only origin fix. Production build and hidden-answer QA passed. Six no-network startup/origin regression tests passed against the installed NextRequest. The real localhost Next production server then passed all N=1–10 scenarios, plus third-strike and Give Up. Tests included creator preview/exclusion, early submission refusal, forged/replayed token refusal, cross-origin refusal, hint/wrong-guess persistence, terminal resolution, completed restoration, first admission and idempotent resubmission.

Isolated project iklbnlicgsxxhaoiscor began with zero Custom rows; final SQL verification found 12 issued challenges, 12 completed attempts, 12 accepted completions and 57 at-bat results. Production dwreeiydvwikpamlokji remained at zero in all four Custom tables. No production credential or fixture was used. An existing QA-only service-role key was transferred to a disposable Vercel sandbox after explicit owner approval; the temporary receiver was stopped, the browser clipboard cleared and the sandbox key file removed after the run. QA pause was requested after verification; fixture rows are retained as test evidence, not removed.

This is genuine application HTTP→hosted database acceptance. It is not live browser-to-database/mobile acceptance, historical v1 acceptance, ordinary-user creation, abuse/rate controls, or public activation. Those gates remain open.
