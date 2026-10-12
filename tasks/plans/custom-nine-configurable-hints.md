# Initial Baseball — Custom Nine configurable hints: implementation plan

**Status:** Proposed implementation plan, drafted 2026-10-11; reconciled with 2026-10-12 `main` at `5b8b97aad54fe4ec02aa599b279cd97a8247772c`. Planning artifact only; no runtime activation.  
**Original planning baseline:** `85d197efbeb68bd9b751ef367b01475e2dc47a2d`. The baseline has advanced: PRs #385 (attempt resume) and #386 (browser transport) are merged, while the public Custom Nine player route is still not implemented.  
**Canonical destination:** `tasks/plans/custom-nine-configurable-hints.md`, linked in `tasks/todo.md`.

## 1. Product contract

- One **shared, ordered set of exactly four hints** applies to all nine selected players.
- Creator chooses from an **approved, finite catalog**, and can reorder those choices.
- Default is the current four hints and current order. Customization is optional.
- **Batting side** (left/right/switch) and **throwing arm** (left/right) are two independently selectable hint categories, subject to verified per-player source coverage; never infer one from player role or substitute one for the other.
- `stats` may specify a **career** scope or **one explicit season** and a bounded ordered list of hitter and pitcher fields, independently configured. All nine players use the same selected season when season scope is chosen.
- For a canonical two-way player, an initial `stats` recipe must fail creator preview/issuance with an explicit private diagnostic. Do not let the existing formatter silently treat `two_way` as hitter-only or pitcher-only. Two-way stat selection requires a separately reviewed explicit role/both-lines contract before the restriction can be lifted.
- Creator can preview all 36 actual clue values and any validation/redundancy warnings before issue; server decides publishability.
- Reject missing, unsupported, contradictory, or untrustworthy player facts before issuance; do **not** substitute `Unknown` or silently fall back to career data for a season selection. Zero is a valid statistic, not missing data.
- Hint position continues to determine the existing points-v4 outcome: slot 1 triple, 2 double, 3 single, 4 walk; initials home run and existing strikeout rules unchanged.
- On issue, snapshot stores **frozen configuration, layout/labels and all 36 clue values**; subsequent changes to source stats or catalog do not rewrite a challenge.
- Challenge-specific comparison only. Do not compare raw scores across independently authored challenges as though they have equal difficulty.
- Existing Custom Nine schema-1 puzzles remain readable/playable; standard Daily and Archive remain unchanged.
- No arbitrary creator-supplied hint text, titles, AI text, per-batter hint configuration, or configurable scoring in this tranche.

## 2. Actual architectural baseline

- `packages/shared/src/types/gameSettings.ts`: `HintType` is currently `main_decade | teams | position | stats`. Default four slots are fixed.
- `packages/shared/src/types/stats.ts`: hitter/pitcher statistic field enums already exist. `packages/engine/src/hints/buildStatsHint.ts` already formats configured career fields; reuse rather than duplicate.
- `packages/baseball-data/src/runtime/types.ts`: canonical reveal model already contains career and seasonal batting/pitching/advanced lines. Coverage, source provenance, 2026 availability, two-way players and year-by-year aggregation still require audit.
- `packages/shared/src/types/player.ts`: gameplay `Player` does not currently carry batting-side/throwing-arm fields; do not assume either hint is ready.
- `packages/daily/src/permanentDailyIssuedClueSnapshot.ts`: frozen nine-by-four clue snapshot supports only the four existing hint types, with unique types.
- `packages/daily/src/customNineIssuedChallenge.ts`: issued Custom Nine schema is 1; the private snapshot is deeply frozen.
- `apps/web/app/materializeCustomNineIssuedClueSnapshot.ts` builds from standard Daily hints; no recipe input.
- `supabase/migrations/20261009032000_create_custom_nine_issued_challenges.sql`: append-only private challenge table requires challenge schema version 1 and clue snapshot version 1.
- `apps/web/app/serverCustomNineBootstrap.ts` materializes issued clues into the existing Daily-shaped points-v4 runtime; new hint kinds/labels must be verified through this projection and signed active-batter reveal, not merely stored successfully.
- Custom Nine public gameplay UI is not yet shipped; current admin-only creator exists. Result submission and comparison remain default disabled under separate activation requirements.

## 3. Intended architecture and decisions

**Contracts and dependency direction**

1. `packages/shared`: stable transport discriminants/field enums only where cross-layer serialization actually requires them. Do not use the globally default Daily hint list as the Custom Nine catalog.
2. `packages/baseball-data`: sourced canonical player facts, provenance, season aggregation, missing-value semantics, coverage report. No UI or DB access.
3. `packages/engine`: pure stat formatting or score rules if existing engine-owned functions can be extended safely; **do not** change points-v4 calculations.
4. `packages/daily`: pure `CustomNineHintRecipe` validation and compilation of a configuration plus supplied canonical facts into an immutable clue snapshot. No clock/DB/React imports.
5. `apps/web`: server-only canonical fact retrieval, preview/issuance orchestration, authorized API endpoints, admin UI, and adaptation of frozen values into existing Custom signed gameplay.
6. Supabase: private append-only schema-version support and strict row decoding, **not** hint logic.

**Example of a conceptual recipe** (not a committed TypeScript API):

```ts
{
  schemaVersion: 1, // recipe version; independent of issued-challenge schema
  slots: [
    { kind: 'batting_side' },
    { kind: 'debut_year' },
    { kind: 'position' },
    {
      kind: 'stats',
      period: { kind: 'season', year: 2026 },
      hitter: ['ops', 'hr'],
      pitcher: ['era', 'k']
    }
  ]
}
```

The approved catalog should start with verified options: decade, teams, position, career/season stats, debut year, independent batting-side and throwing-arm hints **only after each field's source coverage is proven**. Jersey numbers, awards, birthplace, or WAR fields with disputed/incomplete provenance are **future catalog candidates, not initial commitments**.

**Storage compatibility:** Introduce a Custom Nine-specific versioned clue contract rather than broadening the legacy permanent Daily snapshot in place. Keep existing version-1 challenge rows and URL IDs intact. A new schema-2 private challenge carries a recipe identifier/version plus the four slot labels and 36 frozen values. Database CHECK must explicitly permit and shape-check versions 1 and 2. Runtime read must discriminate and validate both. Do not regenerate v1 clues or backfill historical rows. The `custom-nine-v1-` URL prefix is a challenge-identity namespace, not a reason to renumber all existing URLs.

**Security:** Preview and configuration never authorize an anonymous answer-bearing read. Admin-only preview may return clues to the authenticated creator. Anonymous player APIs return only authorized current-batter data and public redacted initials. Maintain challenge-bound signed token, server-monotonic attempt ledger, stale-CAS handling and creator exclusion; new recipe choices must not permit old stateless endpoints to enter competition. Client configuration is never trusted as issuance authority.

## 4. PR sequence — one concern, one primary owner, one review

**Finish already active baseline before starting feature expansion**

**PR 0 — Resume state in Custom Nine attempt bootstrap (completed in #385)**  
Owner: `apps/web`, HTTP/server attempt composition. Verified restored strikes and completed at-bats for in-progress attempts; the separate headless gameplay transport (#386) is also merged. Preserve the security and spoiler-safety contracts in the subsequent player-facing route. No hint customization.

**PR 1 — Playable Custom Nine browser route**  
Owner: `apps/web` player UI/controller. Reuse server-authoritative `attempt/bootstrap`, `hint`, and `resolve` APIs; render initial/four-hint/guess/Give Up/reveal/share flows, mobile and keyboard parity, resume/reload. No client-owned score authority, no result flag activation. Keep player controller bounded; don't clone the entire Daily mega-component. End-to-end public spoiler audit.

**Customizable-hint series**

**PR 2 — Portable Custom Nine recipe contract**  
Primary owner: `packages/daily` (shared types only as necessary). Define immutable, versioned four-slot recipe, allowed discriminants, bounded stat field arrays, career/one-season period, duplicate/unsupported rejection, default projection, copy/normalization. Pure tests on invalid shape, reordered slots, year bounds, missing stat fields, mixed roles. No web route, DB change or new data source. Freeze exact allowed statistics; do not label `war` as `bWAR` unless supported by source semantics.

**PR 3 — Batting-side and throwing-arm enrichment and coverage audit**  
Owner: `packages/baseball-data`. Inspect existing source/reveal pipeline for `bats` and `throws` and provenance. Introduce normalized, explicitly nullable canonical fields only with a reproducible source/correction path. Include population coverage and cases (switch-hitter, left/right pitcher, two-way, missing, old player). Do not fill unknown from guesswork. Stop if adequate rights/source/coverage are absent; disable the unsupported option independently until resolved.

**PR 4 — Career/season stat fact adapter and formatting**  
Primary owner: `packages/baseball-data` for normalized season/career fact access; a separate tiny engine-owned formatting follow-up if formatting needs new logic. Audit season aggregate across multiple teams, missing seasons, 2026 coverage, counting vs rate stats, denominator/innings rules, and advanced WAR provenance. Exact tested output for each supported hitter/pitcher field. No new remote runtime data dependency. If 2026 or WAR incomplete, restrict allowed year/field combinations instead of serving approximations.

**PR 5 — Pure recipe-to-frozen-clue compiler**  
Owner: `packages/daily`. Given exactly nine resolved canonical identities/facts and validated recipe, return four **ordered, stable labels** plus 36 **nonempty, accurately formatted** values, or explicit *private* field-level diagnostics for the creator. Reject stats recipes involving a `two_way` player until an explicit role/both-lines display contract is approved; do not silently reuse hitter-only fallback. Add same-value-across-nine advisory warnings without forbidding themes. No persistence, network, or answer-bearing public API. Provide tests for mixed hitter/pitcher, field/season gaps, zero, two-way ambiguity, duplicate hints and order. Server edges sanitize all failure text.

**PR 6 — Versioned Custom-only frozen challenge contract**  
Owner: `packages/daily`. Add discriminated schema-2 Custom clue/challenge shape, recipe metadata and strict clone/freeze/validation; preserve schema-1 decoding/behavior and challenge ID. Verify currently signed runtime adapter can faithfully consume new hint labels/kinds without changing Daily defaults or score semantics. Stop if this requires a generic refactor of Daily/Archive; decompose that refactor explicitly.

**PR 7 — Additive private Supabase schema migration**  
Owner: Supabase SQL. Loosen only the precise CHECK constraints needed for schema 2 and validate its frozen shape; retain append-only SELECT/INSERT only, RLS and service-role grants. SQL rollback/negative tests and hosted ledger reconciliation before applying. No browser API or data change.

**PR 8 — Schema-2 private provider codec**  
Owner: `apps/web` storage adapter. Strict v1/v2 row encode/decode, re-read immutable first-write winner, reject malformed/mismatched facts. Regression tests with actual v1 fixtures. No migration or public request changes.

**PR 9 — Authenticated preview transport**  
Owner: `apps/web` server/API. Admin-only same-origin bounded preview endpoint taking exact nine canonical IDs and one recipe; return only creator-authorized 9×4 clue preview, warnings and precise actionable validation errors without writing a challenge. Enforce authorization before body parsing; bound request/response sizes and frequency. Public metadata remains redacted.

**PR 10 — Configurable issuance transport**  
Owner: `apps/web` creation route/service. Accept optional recipe (absent means current defaults), re-validate/recompile server-side and issue exactly one immutable schema-2 challenge, creator browser marker unchanged. Retry/conflict behavior and hidden-answer checks. Old schema-1 puzzles and v1 issuers remain readable. No anonymous creator opening.

**PR 11 — Creator UI**  
Owner: `apps/web` admin. Add optional Customize Hints, four reorderable slots with accessible keyboard controls, bounded hitter/pitcher stat field pickers and career/season selector, all-nine preview plus redundancy/missing-data warnings, issue lock and copy/share. Test mobile, keyboard, screen readers, cancel/retry, and no unintended reissue.

**Subsequent independent scopes**  
- User-facing display verification on v1/v2, full signed attempt and spoiler regression.  
- Public creator abuse/rate/retention and identity decision **before** any anonymous write activation.  
- Competition flag activation only after a separately approved integrity/abuse audit.  
- Privacy-conscious product instrumentation: creation started/completed, customization adoption, preview-to-issue, share, unique visitors per challenge, completion, player-to-creator conversion, D7 return. Distinguish admin tests and unique-human limitations. Avoid answer payloads or new cross-challenge tracking IDs.

## 5. Per-PR scope contract and release gates

Before every implementation PR, document: **Goal; primary owner; in scope; exclusions; acceptance checks; stop conditions**. Branch from verified latest main; avoid stacked unrelated changes. Keep handwritten files under normal size/scope limits; add test coverage in the owning layer; inspect dependency direction and duplication. PR body must include the repository's architecture assessment and the exact heading `## Documentation impact`.

**Required gates:** focused tests; typecheck/lint/build as applicable; full required CI at exact PR head; READY Vercel Preview matching exact SHA; one bounded independent fresh-eyes review; fix in-scope issues; merge only after gates pass. After merge verify main SHA, push CI, READY production, canonical public/admin routes, runtime logs, open-PR state, and hosted Supabase/migration/grants when applicable. Record actual evidence in the canonical plan; no claimed success without verification. Preserve feature flags at default-off absent an explicit activation decision.

## 6. Architecture stop conditions

Pause and split scope if: a hint requires an unlicensed/unreliable data source; season stats from two-way/multi-team players cannot be identified deterministically; runtime assumes exactly the old four hint kinds; schema-v2 read breaks schema-v1 challenge restoration; a preview endpoint would expose private future clues to anonymous clients; the work changes scoring/competition identity; public anonymous creation requires rate/abuse infrastructure; or any change exceeds normal PR size/ownership triggers.

## 7. Success definition

Creators can build a *2026 Mets* puzzle using four useful selected hints, choose exact 2026 stats for both hitter/pitcher roles, see 36 verified clues before issue, share one permanently frozen challenge, and have every recipient play the same four-stage points-v4 experience. A friend opening it later sees neither drifted stats nor private future hints. Historical Custom Nine, Universal Daily and Archive remain unaffected. Instrumentation should eventually test whether customization improves sharing, participation and repeat creation—not assume that it does.