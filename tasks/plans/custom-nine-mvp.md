# Daily Nine — Custom Lineup MVP

Status: Owner-approved implementation sequence; first bounded PR is portable selection only.  
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

1. **Portable exact-nine selection contract** — `packages/daily` validates nine distinct ordered syntactic canonical IDs, returns a defensive immutable copy, and tests all boundaries. Does not create an accessible puzzle or validate player existence. This is the present PR.
2. **Issued challenge contract and Supabase persistence** — explicit versioned challenge ID, server-frozen hints, first-write immutable write/read, service-role-only access and RLS; same canonical data-quality and no-answer-leak invariants as immutable Daily archives. New migration and provider boundary require separate review.
3. **Creation and redacted read APIs** — validate full canonical identity and supported hint facts, freeze once, return opaque challenge URL, no untrusted-score submission. Creator/test identity handling must not turn into authorization via an untrusted client field.
4. **Playable route/progression and result integration** — reuse existing Daily Nine engine, signed hints/reveal, point scoring, browser isolation, existing result/comparison infrastructure keyed by exact challenge ID/ruleset. Do not mix current, archives or other challenges.
5. **Creator UI and invite/share flow** — select/reorder nine, preview without contribution, issue immutable challenge, copy/share link; mobile and accessibility QA. Public leaderboard eligibility for custom challenges is a scoped follow-up after proving contributor isolation.

## Scope contract for the first PR

**Goal:** Create one reusable, tested canonical-ID selection contract for exactly nine manually ordered players.  
**Owner:** `packages/daily`.  
**In scope:** Pure validator, index export, focused tests, and recording the newly approved Custom Lineup product direction in canonical docs.  
**Out of scope:** URLs, authentication, Supabase, hints, issuance, routes, UI, results, leaderboard, gameplay or the Specific Lineup/H2H modes.  
**Acceptance:** Nine ordered nonempty IDs, no duplicates, input mutation isolation, invalid input rejection, existing package tests and full CI, bounded independent review, READY Preview, production verification.  
**Stop:** The next step requires new persistence or client/server authority; do not fold it into this PR.

## Boundary note

This selection structure alone is **not** a playable or shareable custom game. Later work must resolve canonical existence, freeze clue snapshots, authorize gameplay and isolate all result populations before any links are exposed.
