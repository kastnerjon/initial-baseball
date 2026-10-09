# Daily Nine — Custom Lineup MVP

Status: #347, #348 and #349 all merged and verified in production. #349 applied in Supabase as migration 20261009033237 (hosted tool assigned a different version from published repo migration `20261009032000`; do not rename the source migration or replay it; reconcile ledger explicitly per environment before CLI pushes). PR #351 merged and release-verified the server-only Supabase repository adapter and strict row codec. PR #352 adds only Custom Nine canonical-player validation and four-hint snapshot materialization. Creation API and gameplay remain unimplemented.  
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
6. **Creation and redacted read APIs** — freeze/issue the validated selection with the existing portable service, return an opaque challenge URL, no untrusted-score submission. Creator/test identity handling must not turn into authorization via an untrusted client field.
7. **Playable route/progression and result integration** — reuse existing Daily Nine engine, signed hints/reveal, point scoring, browser isolation, existing result/comparison infrastructure keyed by exact challenge ID/ruleset. Do not mix current, archives or other challenges.
8. **Creator UI and invite/share flow** — select/reorder nine, preview without contribution, issue immutable challenge, copy/share link; mobile and accessibility QA. Public leaderboard eligibility for custom challenges is a scoped follow-up after proving contributor isolation.

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
