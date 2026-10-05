# Archive beta issuance on editorial publication

Status: Merged and production verified; authenticated mobile interaction remains deferred prelaunch QA
Last updated: 2026-10-05

## Scope contract

- **Goal:** authenticated publication of a beta-eligible editorial lineup completes only after its immutable archive copy is read back by date and number; a retry can finish that copy without republishing.
- **Owning layer:** `apps/web` server-only lifecycle orchestration.
- **In scope:** shared issuance/read-back composition, publication orchestration, existing lifecycle POST integration, a published-lineup verification button, an archive completion gate preserving that retry path, sanitized conflict classification, focused tests, and checkpoint documentation.
- **Out of scope:** schedule-triggered freezing, cron, public archive gameplay, permanent epoch, scoring, schemas/grants, dependencies, and live editorial approval.
- **Acceptance checks:** publish precedes issuance; rejected publication never issues; scheduling/pre-epoch publication remain unchanged; archiving verifies before retiring the published retry path; future published dates may be frozen; exact retries preserve revision, audit metadata, timestamp and content; provider/conflict/read-back failures produce sanitized non-success; origin/auth precede all I/O; focused tests, web typecheck, strict data/build/answer-leakage and repository checks, fresh bounded review, exact-head CI/Preview, then main/push CI/exact production/canonical HTTP/log/database checks.
- **Stop conditions:** distributed transaction semantics, changing portable lifecycle rules or archive identity, new infrastructure, >12 handwritten source/test files or ~600 net handwritten lines require separate scope. Authenticated mobile interaction remains tracked in #294 as deferred prelaunch QA.

## Architecture decision

Publication is the existing immutable seam. Scheduling does not freeze archive content because scheduled selections remain editable. The web operation first commits the portable publication, then invokes the existing immutable issuance service and verifies both read identities. These are separate writes, not a distributed transaction. If issuance fails, publication stays committed and an authenticated Verify archive copy retry reuses the published record without adding another revision or audit event. The operation exposes only safe confirmation/error metadata.

Future publication may freeze future content; public availability must still reject future dates when archive gameplay is implemented. This step adds no public reader or request-triggered writes. Existing explicit manual issuance retains its current Pacific date ceiling.

## Documentation checkpoint

#293 merged at `2a92d75f27246be5fc47c9bf446b422cd1d80351`; exact production was READY and push CI #1016 passed. The authenticated October 4 first issue returned 303 at `2026-10-05T01:39:24.760Z`. Its repeat returned 303 at `2026-10-05T01:43:00Z`; one beta row, zero permanent rows, original timestamp and content remained unchanged. Mobile layout/interaction is still pending in #294.

## Local verification

50 focused tests passed, covering publication order, failed transitions, committed-publication retry, revision/audit preservation, unchanged scheduling/pre-epoch paths and verified archive transitions, manual date ceilings, immutable conflicts, exact read-back, and authorization/origin/sanitized route responses. Web typecheck/lint, file-size/diff checks, full strict data pipeline (zero critical issues), production Next build and hidden-answer QA passed. The hosted first-issue timestamp/content fingerprint remain unchanged. Browser/mobile interaction is not claimed and remains deferred in #294.

## Bounded review disposition

The fresh review identified two completion-integrity defects, fixed within this same concern: a beta archive transition now verifies before leaving the only supported published retry state, and immutable-content conflicts preserve a sanitized non-retryable 409 classification. No portable lifecycle/storage change is needed; no archived content is reinterpreted. Added regression checks cover successful archive ordering, failure preserving publication, invalid transitions and conflict mapping.

## Production completion

#295 final head ba5597b30c3171f167df0dcc437cc58a3f16ad46 passed CI #1018 and READY Preview after both review fixes. Merge b20f0b414512d83260900d2cbd42faa7ef51f0e4 passed push CI #1019; exact production dpl_GndGRQ15MAiq2Do34uKQhdy279Yy was READY/canonically aliased, HTTP 200 and error/fatal scan clean. Read-only database checks preserved the October 4 beta row, original timestamp/content fingerprint and zero permanent rows. No live editorial approval/publication was performed from this implementation thread; authenticated admin/mobile QA remains #294.
