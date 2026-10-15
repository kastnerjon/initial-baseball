# Custom Lineup v2 — private immutable issuance

Status: bounded Web-only implementation PR after #417; no public activation.

## Scope contract
- **Goal:** privately issue one immutable v2 challenge from 1–10 ordered distinct canonical players, with exact four-hint snapshots and opaque-only output.
- **Owning layer:** `apps/web` server composition / existing service-role repository boundary.
- **In scope:** reuse portable v2 selection/issued challenge contracts, reuse Daily canonical lookup/default hint materialization with a v2 length policy, write through the installed versioned Supabase `custom_nine_issued_challenges` table using schema 2, guard immutable collisions, focused service/row tests, and handoff documents.
- **Out of scope:** any public/admin HTTP creation endpoint, creator marker cookie issuance, browser creator workflow, activation flags, comparison, extra hint controls, schema migration, scoring changes, Daily/Classic/v1 behavior, and public publishing.
- **Acceptance:** N=1/5/9/10 correct ordered frozen clues; reject 0/11, duplicates, unknown and unsupported players before DB; v1 unchanged; insert-only first-write-wins, collision fail-closed; no answer or unrevealed-hint output; all package tests, CI on exact head, READY Preview, one bounded independent review, then postmerge main/prod/log/Supabase/open-PR verification.
- **Stop conditions:** HTTP access, anonymous creation, account ownership, migration or public flag change must be separately reviewed before implementation.

## Architecture and dependency check
The existing `packages/daily` v2 constructors validate selection length and frozen clue order; no new domain rules or dependencies. Extend the current Web server-side Daily materializer only to select the already-approved v2 snapshot constructor. Store the versioned 2 snapshot in the existing service-role-only table via an insert-only Web repository using the existing strict v2 row decoder; no upsert or browser data access. The private orchestration returns only the challenge ID. Existing v1 read/write paths remain exact-nine. Dependency direction and portability unchanged.

## Release sequencing
After this private backend: (1) separately gated/admin-authenticated, same-origin, body-bounded v2 creation route that constructs the v2 creator marker before the write; (2) accessible 1–10 creator UI; (3) staged real E2E/mobile tests, abuse/privacy safeguards, and explicit activation decision. Production Custom remains disabled throughout this PR.
