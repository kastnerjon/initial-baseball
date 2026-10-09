# Daily Nine — Custom Lineup MVP

Status: PR #347 portable selection merged and production-verified; PR #348 adds the private immutable challenge record and provider-neutral issuance/read contract (no storage).  
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

1. **Done in #347: Portable exact-nine selection contract** — `packages/daily` validates nine distinct ordered syntactic canonical IDs, returns a defensive immutable copy, and tests all boundaries. Does not create an accessible puzzle or validate player existence. This is the present PR.
2. **PR #348: Pure private issued challenge + service** — UUIDv4-prefixed puzzle ID, fixed points-v4, exact nine canonical identities, reusable existing four-hint snapshot validation, defensive deep freeze, provider-neutral first-write-wins issuance and private getById. No player existence check or storage yet.
3. **Separate Supabase migration/adapter** — append-only challenge storage, indexed private read, RLS, service-role-only permissions, no browser access; independently reviewed and hosted-verified.
4. **Creation and redacted read APIs** — validate full canonical identity and supported hint facts, freeze once, return opaque challenge URL, no untrusted-score submission. Creator/test identity handling must not turn into authorization via an untrusted client field.
5. **Playable route/progression and result integration** — reuse existing Daily Nine engine, signed hints/reveal, point scoring, browser isolation, existing result/comparison infrastructure keyed by exact challenge ID/ruleset. Do not mix current, archives or other challenges.
6. **Creator UI and invite/share flow** — select/reorder nine, preview without contribution, issue immutable challenge, copy/share link; mobile and accessibility QA. Public leaderboard eligibility for custom challenges is a scoped follow-up after proving contributor isolation.

## Scope contract for PR #348

**Goal:** Define and validate one frozen, private Custom Nine issued challenge and pure provider-neutral first-write-wins/read service.  
**Owner:** `packages/daily`.  
**In scope:** Versioned record, opaque UUIDv4 ID validation, fixed points-v4 policy, existing hint-snapshot reuse, immutable retries/conflicts, repository interface, focused tests, index export and status documentation.  
**Out of scope:** Supabase schema and adapter, identity generation, actual canonical existence checks, clue materialization, HTTP routes, UI, gameplay/result/leaderboard integrations, user identity, Specific Lineup and H2H.  
**Acceptance:** Validated opaque IDs, immutable exact-nine matching frozen clues, defensive copies, first-write-wins with idempotent retries and immutable conflicts, fail-closed private reads, focused tests, full CI, bounded review, READY Preview and production verification.  
**Stop:** Persistence, exposing answer data, identity generation and public HTTP semantics are separate concerns.

## Boundary note

The selection and pure issued-record contracts alone are **not** a playable or shareable custom game. All issued records are private server-side data. Later work must resolve canonical existence, freeze clue snapshots, authorize gameplay and isolate all result populations before any links are exposed.
