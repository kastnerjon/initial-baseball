# Sourced intra-season team chronology

## Scope contract
- Goal: Correct Abreu's HOU → PHI → NYY → LAA → LAD → NYM reveal, his PHI then NYY 2006 row, and prospective Teams hints through shared data generation.
- Owning layer: baseball-data source projection and display generation.
- In scope: Commit a reproducible pinned Lahman multi-team stint projection with source checksums; use one strict source-ID sequence resolver in runtime reveals and legacy hint overrides; regressions for trades, three-team years, returns, unavailable/conflicting evidence and pipeline consistency.
- Out of scope: New player/stat populations, scoring, UI layout, search, database writes, frozen issued contracts and historical hint rewrites, Custom activation.
- Acceptance: Source projection coverage/conflict checks; focused and full package tests, runtime generation and web build, typecheck/lint/file sizes; independent review; exact-head CI and READY Preview; exact-main production verification.
- Stop: Missing or conflicting multi-team ordering fails generation rather than guessing. A new source or contract change requires separate scope.
- Rollback: Revert source/generator change together; no data migration. Issued contracts remain immutable.

## Root cause and evidence
The committed Batting/Pitching CSVs omit stint/teamID, while Appearances has no stint. The old helper alphabetized clubs within a year and fabricated return stints across adjacent years. Full Lahman uses stint for order of appearances within a season. The compact projection retains playerID/yearID/stint/teamID for all multi-team seasons represented in committed Appearances. It merges batting and pitching evidence only when the same stint agrees and verifies exact appearance-team coverage. Normal builds remain offline. This is source sequence evidence, not exact transaction dates; unrepresented transactions and returns absent from Lahman cannot be recovered.

## Validation evidence
- All 6,466 multi-team appearance seasons have complete source coverage; 13,345 compact stint rows. Batting/pitching assignments agree on shared stint keys.
- Eight source-level regressions pass, including Abreu, Piazza, Rickey Henderson and Brant Alyea's OAK → STL → OAK in 1972.
- Canonical strict runtime generation: 13,620 players / 78,665 season cards, zero critical issues. Runtime consumer regressions check emitted Abreu/Piazza/Alyea cards.
- Generated runtime overrides remain build outputs; their committed placeholders are not manually patched.
- Exact-head release gates and independent review are recorded in the PR. No production DB/config changes.
