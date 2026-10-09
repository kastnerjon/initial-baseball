# Daily Nine — Custom Lineup MVP

Status: #347, #348 and #349 all merged and verified in production. #349 applied in Supabase as migration 20261009033237 (hosted tool assigned a different version from published repo migration `20261009032000`; do not rename the source migration or replay it; reconcile ledger explicitly per environment before CLI pushes). PR #351 merged and release-verified the server-only Supabase repository adapter and strict row codec. PR #352 adds only Custom Nine canonical-player validation and four-hint snapshot materialization. Admin-protected creation API #358 is merged and release-verified. This checkpoint adds only a redacted public read; signed gameplay remains unimplemented.  
Decision date: 2026-10-08

## Product contract

- **Daily Nine — Universal Lineup** stays the existing common editorial Daily. The approved **Daily Nine — Specific Lineup** mode (team/era/difficulty, one lineup per configuration per day) is paused. **Custom Lineup** is the next priority; head-to-head follows later with its own Classic rules engine.
- A creator manually chooses **exactly nine different canonical players in an explicit batting order**, then creates a stable, shareable challenge link. No team/era/WAR automatic-pool limit applies to manual choices; selection still requires real canonical identities with supported hints.
- Once issued, the nine identities, clue categories, hint values, order, and ruleset are **frozen**, not regenerated when a friend opens the link or when player metadata changes. A custom challenge does not silently roll over every day; the link identifies the same puzzle.
- Friends play the **same Daily Nine points-v4 mechanics and presentation** (four hints, result/score, Your Nine, comparisons, answer reveal, persistence and spoiler-safe sharing), with exact-challenge/ruleset population isolation. The challenge creator can preview/test but cannot produce a contributing competitive result on the creating browser. Anonymous identity cannot prove that a different browser/device is the creator: this limitation must be acknowledged rather than misrepresented as account-grade enforcement.
- AVG/BEAT and leaderboard populations for one custom puzzle must never merge with Universal or another custom puzzle. Creator previews do not contribute to any peer distribution.
- Do not expose selected canonical identities, full names, or unrevealed hints in anonymous loader payloads, HTML, logs, public challenge metadata or share text. Preserve authorized hint-depth tokens and existing resolve-time reveal.
- Use the existing canonical player search and server-only canonical runtime, but **do not treat unvalidated browser-provided IDs as existing canonical players**. The server resolves all nine identities before creating an immutable puzzle.
- The creator UI remains optional and account-free initially. No user-chosen arbitrary text/puzzle titles, AI hints, external authentication, Specific Lineup generator or H2H in the first implementation.

## Implementation sequence — one bounded concern at a time

1. **Done #347: Portable exact-nine selection contract** — `packages/daily` validates nine distinct ordered syntactic canonical IDs, returns a defensive immutable copy, and tests all boundaries. Does not create an accessible puzzle or validate player existence. This is the present PR.
2. **Done #348: Pure private issued challenge + service** — UUIDv4-prefixed puzzle ID, fixed points-v4, exact nine canonical identities, reusable existing four-hint snapshot validation, defensive deep freeze, provider-neutral first-write-wins issuance and private getById. No player existence check or storage yet.
3. **Done #349: Supabase private storage migration** — one append-only challenge table with puzzle-ID PK, version/ruleset/frozen-shape checks, RLS, service-role SELECT/INSERT only. No app adapter or browser role access. Apply/verify hosted schema only after review and merge.
4. **Done #351: Server-only Supabase repository adapter** — implement the existing portable first-insert/read port behind a server-only module and strict row codec; validate returned records and challenge identity, reread the immutable winner on PK conflict, and test with mocked providers. No public route or schema change.
5. **PR #352: Canonical selection and hint snapshot materialization** — resolve nine creator-selected canonical IDs against the existing gameplay-ready server lookup, reuse Daily four-hint materialization in the exact selected order and reject missing/placeholder facts. Keep private candidate identities out of exception text. No database writes or public routes.
6. **Done #358: Admin-only issuance; current bounded PR: redacted public read** — private authenticated creation stores the ordered, frozen nine with four hints and returns only an opaque ID. Add public `GET /api/custom-nine/challenges/{puzzleId}` that reads the private immutable record but exposes only puzzle ID, fixed ruleset and nine ordered initials. Malformed/unknown IDs 404, provider faults 503, no-store responses. It does not return a playable URL, signed token, hint bundle, private clue values or answers. Public writes remain a separate abuse-control decision.
7. **Staged signed gameplay (bootstrap issued; hint progression staged next)** — reuse the existing Daily Nine engine and HMAC codec with a distinct Custom Nine signing domain. An opaque challenge-ID GET returns the points-v4 first-batter signed token, authorized current-batter hint bundle and checkpoints, never future hints or answer IDs. Later bounded PRs must verify Custom-only tokens to authorize hint progression, then guess resolution and exact-challenge/ruleset-isolated results with creator noncontribution. Do not mix current, archives or other challenges.
8. **Creator UI and invite/share flow** — select/reorder nine, preview without contribution, issue immutable challenge, copy/share link; mobile and accessibility QA. Public leaderboard eligibility for custom challenges is a scoped follow-up after proving contributor isolation.

## Current bounded scope — secure Custom Nine hint progression

**Goal:** Authorize restoration and one-step reveal of the signed Custom Nine current batter's frozen hints, without resolving guesses or advancing batters.
**Owning layer:** `apps/web` server-only runtime/HTTP composition. Portable hint/ruleset logic and Supabase storage are unchanged.
**In scope:** Two read-only POST adapters `/hints` (restore) and `/hint` (next signed checkpoint); mandatory Custom HMAC verification and exact challenge ID, noncalendar session date, incomplete state and points-v4 binding before Supabase read; existing Daily hint logic and frozen issued snapshot materialization; bounded request body; 400/404/503 sanitized no-store responses; focused source/route/security tests.
**Out of scope:** Any guess, answer reveal, terminal/next-batter resolution, results/comparisons, creator identity/eligibility, web UI, new secrets, Supabase writes/migrations or Universal Daily/Classic/Archive changes.
**Acceptance checks:** Invalid/cross-domain/mismatched/completed tokens perform zero private reads; valid tokens restore only current hints/checkpoints and advance one depth; no answer names/IDs or future-batter values in responses; targeted security tests, typecheck, full CI, independent review, exact-head READY Preview and postmerge smoke checks.
**Stop conditions:** Any need to allow anonymous result writes, accept Universal tokens, regenerate frozen hints, alter scoring or add an identity/anti-replay infrastructure requires a separate PR.

## Current bounded scope — signed opening bootstrap for Custom Nine

**Goal:** Issue an opening points-v4 Custom Nine session and first-at-bat hints based solely on an immutable challenge, without creating a playable resolver.
**Owner:** `apps/web` server-only runtime composition and thin read-only GET route.
**In scope:** Validate puzzle ID before Supabase; retrieve the private frozen challenge, project nine public initials; materialize the first active hint bundle via the existing Daily runtime using **frozen** hint values; sign an opening token and four reveal-depth checkpoints under a Custom-specific HMAC domain derived from the existing progression secret; no-store sanitized 404/503 responses and focused source/route/security tests.
**Out of scope:** Guess evaluation, hint advancement endpoints, final resolution, result/leaderboard writes, browser gameplay route, new account/secret, public creation, schema changes.
**Acceptance:** Bad IDs never touch Supabase; all 9 initials in frozen order, 1 active batter bundle only, first-batter values unchanged, no answer names/IDs/future-pitch clue values in JSON; tokens verify under Custom but **not** Universal key and vice versa; exact-head CI, READY Vercel preview, bounded fresh-eyes review, read-only postmerge smoke tests.
**Stop:** Any need to reuse Universal token signatures, change scoring or allow competitive submissions is a separate decision.

## Prior scope — redacted read of Custom Nine challenge

**Goal:** Publish the minimal safe challenge metadata for an opaque ID, without making it playable.
**Owner:** `apps/web` server-only lookup composition and read-only API route.
**In scope:** Exact UUIDv4 challenge ID validation before Supabase; existing private first-write-wins repository and portable getById validation; explicit projection of `puzzleId`, `rulesetVersion`, and nine ordered `{ pitchNumber, initials }` only; generic 404/503, private no-store responses, mock tests and docs.
**Out of scope:** Playable route/bootstrap, signed progression, hints, player identities or hint layout, results, public creation, new auth/rate limiting, UI, schema changes, server data writes.
**Acceptance:** Invalid IDs never touch database; known record response includes no player canonical IDs, names, hidden hints or issued timestamp; corrupt/wrong-version rows fail closed; errors cannot echo secrets; exact-head CI and READY preview, bounded independent review and post-merge read-only checks. No synthetic production records.
**Stop:** Any change to public disclosure beyond initials, new persistence, or auth/answer authority requires a separate scope decision.

## Prior scope — private Custom Nine challenge creation API

**Goal:** Wire the previously delivered pure selection/issuance/materializer/repository stages behind a safe internal creation endpoint; provide a private immutable challenge ID but do not imply playability.  
**Owner:** `apps/web` server-only composition and thin protected HTTP route.  
**In scope:** Exact JSON shape and byte limit; reuse existing Daily admin Basic authorization and same-origin mutation guard; canonical existence/complete-clue validation; server-generated UUIDv4 and UTC issuance timestamp; first-write-wins insert through existing service-role-only Supabase port; only return `puzzleId` and sanitized errors.  
**Out of scope:** Public anonymous creation, rate limiting or a new identity scheme, gameplay/bundle authorization, redacted GET, URL routing, result submission, creator exclusion, frontend, schema or portable contract changes.  
**Acceptance:** Auth happens before body parsing and Supabase access, invalid and duplicate lineups cause no writes, canonical failures hide IDs/hints, stored exact-order 9×4 snapshot is immutable, production route never returns private records, CI and READY preview plus bounded independent review. Live smoke probes must not insert synthetic challenges in production.  
**Stop:** Unauthenticated public writes, creator fingerprinting, auth policy changes, new schema or missing canonical facts are separate architecture decisions.

## Completed storage scope and next adapter boundary

**Goal:** Add the server-only, append-only Postgres persistence shape for the #348 challenge record, without exposing a gameplay route.  
**Owner:** `packages/daily`.  
**In scope:** One additive Supabase table and schema checks, RLS and service-role-only INSERT/SELECT privileges, Supabase runbook and canonical status documentation.  
**Out of scope:** App repository adapter/codec, player/answer validation in SQL, ID minting, HTTP routes, hint authorization, game/result/leaderboard flows, creator identity, Specific Lineup and H2H.  
**Acceptance:** Valid schema for private immutable records, no anon/auth access, service-role SELECT/INSERT and no UPDATE/DELETE, RLS on, exact-head CI and READY Preview, bounded review and deliberate post-merge hosted migration read-back.  
**Stop:** Introducing any public database access, creation endpoint, or repository changes is a separate PR.

## Boundary note

The selection and pure issued-record contracts alone are **not** a playable or shareable custom game. All issued records are private server-side data. Later work must resolve canonical existence, freeze clue snapshots, authorize gameplay and isolate all result populations before any links are exposed.

## Scope contract for PR #351 — server-only repository adapter

**Goal:** Connect the existing portable Custom Nine issued-challenge port to the already-deployed private Supabase table without making challenges publicly accessible.  
**Owning layer:** `apps/web` server-only persistence adapter; portable domain validation stays in `packages/daily`.  
**In scope:** One private Supabase insert/read adapter, strict versioned row codec reusing the existing clue-snapshot validator, first-write-wins conflict read-back, focused mocked-provider tests, and canonical status notes.  
**Out of scope:** Schema or migration changes, synthetic records, HTTP routes, canonical existence validation/materialization, public read, hint delivery, result comparison, creator identity, UI, Specific Lineup and H2H.  
**Acceptance:** Encode/decode with full nine-player/four-hint validation; incorrect/missing/corrupt returned rows and mismatched IDs fail closed; 23505 returns only the immutable existing record; provider errors fail closed; exact-head CI and READY Preview, bounded independent review, and full post-merge release verification.  
**Stop conditions:** Any need for a new schema, service-role privilege, public API, or player-data lookup belongs in a separate scoped PR.

## Scope contract for PR #352 — canonical Custom clue materialization

**Goal:** Provide the server-only canonical player and four-hint snapshot validation needed for a creator-selected nine, reusing the current Daily clue generator without publishing any answers.  
**Owning layer:** `apps/web` server-only canonical content adapter. Existing selection and clue contracts stay portable in `packages/daily`.  
**In scope:** Validate ordered nine with the current Custom selection contract, require all nine to resolve through the gameplay-ready canonical lookup, reuse permanent Daily's four-hint materializer, reject existing unavailable-data placeholders, conceal player IDs and hints in thrown error text, and add focused tests.  
**Out of scope:** Issuance, Supabase writes/DDL, route handlers, public read, authenticated progression, result comparisons, creator UI, new hint types, Specific Lineup and H2H.  
**Acceptance:** Exact order and 4×9 frozen hint values match existing Daily generation; malformed, duplicate or unresolved IDs, incomplete/placeholder hints and private error details fail closed; typecheck, focused tests, full CI, exact-head READY Preview, one bounded independent review and post-merge verification.  
**Stop conditions:** Requiring a new hint source, changing Daily clue behavior, adding a public answer-bearing payload, or widening the canonical data contract requires a separate decision/PR.
