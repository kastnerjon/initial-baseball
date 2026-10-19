# Team-history hint and reveal consistency â€” issue #450

## Scope contract
- Goal: Earned Teams hint and revealed player details show all represented clubs in chronological career-stint order, including returns.
- Owning layer: Existing baseball-data team-history generator and Web renderers.
- In scope: Remove five-club limit and global team dedup; share chronological-stint helper; ensure reveal model does not dedup returns; responsive wrapping; source-derived override for existing committed player universe; focused regressions.
- Out of scope: Source data expansion, ingestion, season coverage, scoring, signed attempts, mutation of existing immutable Daily/Archive/Custom hints, activation flags, discovery, and new storage schema.
- Acceptance checks: Real 10+-stint careers, repeated stints, hint/reveal order, unrevealed hidden information, keyboard/assistive text, narrow/mobile CSS, data and web tests, workspace checks, exact-head CI, READY Preview, independent review.
- Stop conditions: Any proposed change to frozen issued hints, canonical identity, data coverage or security boundary must go to separate decision.

## Findings and compatibility
Legacy generated player \`teamsDisplay\` was sorted by first year, globally deduplicated and sliced to five. Canonical career display identities were globally deduplicated and sorted alphabetically, and the Web reveal view model performed another global dedup. The existing dataset supports season-level club appearances; intra-year tr¶»§q«^