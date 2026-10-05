# Archive-beta activation and explicit issuance

Status: implemented; review and deployment verification pending
Last updated: 2026-10-05

## Scope contract

- **Goal:** explicitly begin the disposable archive-beta series at October 4, 2026 and let an authenticated administrator freeze a real scheduled/published puzzle through the reviewed issuance service.
- **Owning layer:** `apps/web` server-only operational composition and its existing admin boundary.
- **In scope:** explicit beta epoch configuration in source; date admission; one authenticated POST action; small admin form; immutable service invocation; exact persisted read-back; metadata-only confirmation; focused tests; canonical handoff docs.
- **Out of scope:** permanent epoch, recurring issuance, cron, public archive routes/gameplay, comparisons/history, scoring, schema/grants, and arbitrary player payloads.
- **Acceptance checks:** auth and origin admission precede all persistence; malformed, pre-epoch, and future Pacific dates cannot issue; only authoritative editorial content is used; exact retries preserve first issue time; conflicts never rewrite; read-back must match issue result; responses contain no answers/clues; exact-head CI/Preview and fresh review pass, then post-merge production checks.
- **Stop conditions:** new storage semantics, dependencies, gameplay identity changes, or publication scheduling belong in separate work. If authenticated admin access is unavailable, complete deployable code and record the precise operational blocker; do not fabricate rows through a separate write path.

## Activation decision

The beta start date is explicitly `2026-10-04`, the real nine-slot scheduled editorial puzzle verified while starting this step. It maps to `archive-beta-v1-daily-1`. This disposable choice does not set or imply the eventual `permanent-v1` launch epoch. Deployment activates identity resolution only: no row is created without the explicit authenticated POST.

The epoch is source configuration, kept separate from portable calendar logic and from the existing public beta Daily numbering. Changing it after issuance would reinterpret IDs and is prohibited; reset/retirement remains a separately reviewed series operation.

## Operational path

Use the existing Daily administrator credentials and same-origin mutation boundary. Submit a date from the archive-beta section of `/admin/daily`; the endpoint derives beta identity server-side, invokes the existing canonical issuance composition, and reads the frozen row back through the existing beta reader/codec. Only date/number/status/timestamp metadata may leave this boundary. Errors never serialize player IDs, requested/existing puzzles, hints, or provider diagnostics.

A successful mutation can have committed before a read-back/network failure. Retrying is safe: the immutable service preserves the original timestamp/content or reports conflict, never updates it.

## Access evidence

The connected Vercel plugin can inspect exact deployments and fetch protected Previews. Listing project environment variables failed with HTTP 403, `forbidden`: `You don't have permission to list the project environment variable.` No local Daily admin credentials are present. This is an environment-variable permission/app-admin access limitation, not a failure of Vercel plugin authentication. The owner invoked the existing authenticated admin action successfully; no alternative write path was used. Plugin authentication, CLI credentials, and app-admin credentials remain separate access boundaries.

## Verification evidence

The 29 focused activation/route/existing-composition/provider tests pass, web typecheck passes, and the strict data pipeline reports zero critical issues. The production Next build and hidden-answer build QA pass with a local build-only progression secret. A read-only operational check loaded the actual October 4 scheduled editorial record from Supabase, materialized all nine canonical players and issued clues, and round-tripped the existing beta persistence codec. That check used an in-memory write port and created no hosted row. Live first issuance and exact retry are verified. Authenticated mobile layout/interaction remains pending prelaunch QA in #294.

## Verified production checkpoint

PR #293 merged at `2a92d75f27246be5fc47c9bf446b422cd1d80351`, after exact-head CI #1015, clean Codex review and READY Preview `dpl_CpM8G2Q3ukEKKDf3fMaeEewXPH7z`. Push CI #1016 passed; exact production `dpl_HWe5hYRZzNNZWGQLnezb9JxMDkEF` was READY and canonically aliased, HTTP 200, without error/fatal runtime logs. Unauthenticated mutation returned 401; cross-origin mutation returned 403.

The first authenticated POST returned 303 at `2026-10-05T01:39:24.760Z` and created `archive-beta-v1-daily-1` for October 4. Read-only SQL verified schema 2, nine ordered canonical IDs matching the editorial slots, nine aligned clue pitches and four nonempty hints per pitch. An exact retry returned 303 at `2026-10-05T01:43:00Z`: exactly one issued beta row, zero permanent rows, original timestamp and content fingerprint `bfb08ff7892362e0762d858aa3920d53` unchanged. The fingerprint is diagnostic equality evidence, not a security primitive.

Automatic issuance on publication is the separate next scope in `tasks/plans/archive-beta-publication-issuance.md`; explicit manual issuance retains its Pacific date admission policy.
