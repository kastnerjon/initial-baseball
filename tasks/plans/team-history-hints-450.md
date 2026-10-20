# Team-history hint and reveal consistency — issue #450

## Scope contract
- Goal: Earned Teams hint and revealed player details show all represented clubs in chronological career-stint order, including returns.
- Owning layer: Existing baseball-data team-history generator and Web renderers.
- In scope: Remove five-club limit and global team dedup; share chronological-stint helper; ensure reveal model does not dedup returns; responsive wrapping; generate derived team-history corrections from committed Lahman and canonical identity inputs; focused regressions.
- Out of scope: Source data expansion, ingestion, season coverage, scoring, signed attempts, mutation of existing immutable Daily/Archive/Custom hints, activation flags, discovery, and new storage schema.
- Acceptance checks: Real 10+-stint careers, repeated stints, hint/reveal order, unrevealed hidden information, keyboard/assistive text, narrow/mobile CSS, data and web tests, workspace checks, exact-head CI, READY Preview, independent review.
- Stop conditions: Any proposed change to frozen issued hints, canonical identity, data coverage or security boundary must go to a separate decision.

## Findings and compatibility
Legacy generated player `teamsDisplay` was sorted by first year, globally deduplicated and sliced to five. Canonical career display identities were globally deduplicated and sorted alphabetically, and the Web reveal view model performed another global dedup. The #451 implementation used an alphabetical same-year fallback because the slim committed tables omitted stint. This was incorrect as chronology and is superseded by the sourced stint correction in `team-stint-chronology.md`. Adjacent chronological club rows collapse into one stint; a later return is preserved.

A lightweight offline derivation from committed Lahman appearance/team facts and reviewed player identities corrects existing legacy team lists during build/test without changing the committed player population or season coverage. Historical issued Daily/Archive/Custom hint snapshots remain frozen and may retain original five-club values.

## Independent #451 review corrections (October 19)

- Use the same year-and-team keyed `buildTeamDisplayIdentityIndex` as canonical reveals to preserve an abbreviation change across seasons (e.g. TBA: TBD → TBR). The Carl Crawford regression checks both abbreviations in the generated hint.
- Turbo may execute baseball-data build and test concurrently. Generate each override JSON into a unique same-directory temporary file and rename into place atomically, so readers never observe a truncated JSON. No test/build graph changes or runtime dependencies.
- Do not merge until updated exact-head CI and Preview pass and the two review findings have been resolved.
