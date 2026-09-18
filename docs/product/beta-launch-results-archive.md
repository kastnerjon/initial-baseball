# Beta, launch, results, and archive product model

Status: Settled product direction  
Last updated: 2026-09-18

## Purpose

This document records the September 16 product decisions that govern completed results, comparison, archive/history, and the eventual transition from beta to the permanent public Daily sequence.

## Beta versus permanent launch

The current Daily numbering and sessions are beta. They are useful for testing but are not the permanent historical sequence and do not need to be migrated into the eventual public archive.

At a later explicit launch decision, the permanent sequence restarts at **Daily #1**. That launch date becomes the epoch for permanent Daily numbering. Daily #2 is the following Pacific date, then #3, and so on.

Do not infer or hard-code the launch date before the owner explicitly chooses it. The implementation must support the reset without rewriting unrelated gameplay code.

Once the permanent sequence begins, each Daily puzzle is a frozen historical object. Later lineup-generation/profile changes must not silently change an already-issued permanent Daily.

## Two beta games, independently modeled

Daily Nine and Classic Inning are currently two distinct beta games that happen to share the same ordered daily nine-player lineup.

- **Daily Nine** currently uses `points-v3`: all nine at-bats, up to 7 points per at-bat, maximum 63.
- **Classic Inning** currently uses `classic-inning-v1`: baseball runner/run scoring, ending after three outs or nine at-bats.
- Playing one does not count as playing the other.
- Browser saves, completed results, comparison populations, personal history, and share output remain mode/ruleset-specific.
- The shared lineup is a current product choice, not a permanent identity constraint.

The owner expects to use beta feedback to choose one of these games as the primary/sole public product before broad launch. Therefore new infrastructure should be game-aware but should avoid expensive duplicated mode-specific systems before that decision.

Classic must remain independently removable/disableable without corrupting Daily Nine data or requiring deletion of historical Classic code/results. Likewise, the architecture must not prevent a future decision to give the games separate lineups. Neither separation nor a disable control is current implementation scope.

`points-v3` is the current Daily Nine beta policy, not yet a promise that the permanent launch scoring policy can never change. Any scoring change before/after launch still uses explicit ruleset versioning; completed results are never reinterpreted silently.

## Completed-result model

The first comparison architecture should work for either surviving game without treating the games as interchangeable.

A completed-result submission is keyed by stable puzzle identity plus ruleset/game identity and a client-generated idempotency ID. It contains native ordered at-bat facts rather than a trusted client total.

The server validates puzzle identity and internal fact consistency, then derives game-specific summaries using portable engine rules. There are no per-hint or per-guess database writes.

Comparison populations never mix rulesets/games. Daily Nine for one Daily compares only with the same Daily/ruleset. Classic for that Daily is a separate population.

### Daily Nine comparison

Daily Nine v1 shows YOU / AVG asynchronously after every terminal at-bat, without delaying the answer reveal or Next At Bat. Its AB population includes everyone whose observation for that exact puzzle/ruleset/slot has arrived, including partial games. Whole-game averages and score distributions use completed games only; these denominators intentionally differ.

The final scorecard shows personal points and nine AB averages plus the whole-game average and "You beat X% of finishers." Beaten means strictly lower score divided by all completed games; ties do not count. Initial presentation policy: 0–1 observations waits, 2–9 is labeled early, 10+ shows a normal average, and beat-percentage waits for 20 completions. These are presentation thresholds, not database filters.

Comparisons may be briefly cached and need not immediately include the new submission. Previously loaded values render immediately and refresh asynchronously on the final screen; the user's own result never changes. Saving and comparison availability have separate success states. Missing comparisons never block gameplay or sharing. Counts represent anonymous observations, not verified unique people or proof of abandonment.

Retain immutable native AB facts plus server/engine-derived points separately from completed results. Do not backfill old completions into the AB population. Comparison scope: `tasks/plans/resolved-at-bat-comparison.md`; settled browser ownership, reset/legacy and rollout architecture: `tasks/plans/resolved-at-bat-browser-lifecycle.md`.

### Reset and testing

"Reset today's results" is a beta builder/testing control, not a permanent public product feature. Remove it from public UI before broad launch. Any retained admin/test mechanism must be non-contributing. During beta, resetting after any terminal AB was locally recorded makes subsequent play non-contributing; retain original immutable pending submissions. Refresh continues the original run. Multiple tabs must not mix runs or count another run. Public replay is not a launch requirement.

### Classic comparison

Classic receives its own baseball-native comparison rather than being converted into Daily Nine points. Candidate measures include runs, hits, at-bats reached, per-at-bat outcome distributions, strikeout rates, and later-batter reach rates. An overall Classic percentile/ordering metric is not settled yet and should not be invented during the first persistence PR.

Because Classic can end after three outs, later-batter aggregates distinguish players who reached an at-bat from the total number of Classic completions.

## Archive and local personal history

The archive begins with the eventual permanent Daily #1, not with the current beta history.

After launch, every prior permanent Daily remains playable and shareable. An archived Daily should expose whichever games are currently supported for that historical puzzle; while both beta games remain supported, both Daily Nine and Classic can be played independently for the same Daily.

Archived play uses the ruleset associated with the supported game contract rather than attempting to recreate discarded beta-era scoring. The exact launch rules will be frozen only when the launch product decision is made.

The initial no-account experience remembers the user's completed archive history and scores **on that browser/device**. Cross-device history remains deferred until accounts exist. Server-side anonymous completed-result records exist for aggregate comparison; they are not an account identity system.

Archive gameplay must not overwrite the current Daily save. Personal completion/history is keyed by stable Daily identity plus game/ruleset.

## Product sequence

1. Finish outstanding interactive/physical-device QA for the two beta games.
2. Define and test the portable completed-result contract, validation, derived summaries, and idempotent repository boundary.
3. Add the separate Supabase result persistence adapter and one completed-game submission API.
4. Add same-Daily/same-ruleset per-at-bat and whole-game comparison; use independent resolved-AB/completed-game populations and strict-lower-score comparison.
5. Build permanent archive/history infrastructure without importing beta history.
6. Before broad launch, choose the primary game and final launch rules, choose the launch date, reset permanent numbering to Daily #1, and begin the frozen historical sequence.
7. Continue lineup calibration, analytics/monitoring, legal/domain/social metadata, and launch polish.

## Architecture constraints

- Stable result transport types belong in `shared` only when they are genuinely cross-platform contracts.
- Pure validation/derivation belongs in `engine`; React/routes do not own score or completion rules.
- Puzzle/result orchestration and provider-neutral repository/service boundaries belong in the narrowest existing portable layer that owns them.
- Supabase is persistence only and receives a separate current-results migration; inactive legacy attempt/result tables are not repurposed.
- Web routes validate/authorize/compose adapters and format responses; they do not duplicate game rules.
- Raw result facts are retained so aggregates can be recalculated as presentation evolves.
- No per-hint/per-guess writes, generic mode plugin framework, account system, public leaderboard, or cross-device identity is introduced by the initial result work.

## Open decisions

- Which beta game becomes the permanent launch product.
- Whether the two games ever receive separate lineups before that decision.
- Final launch ruleset/scoring contract.
- Permanent launch date / Daily #1 epoch.
- Classic overall comparison/percentile metric, if any.
- Replay policy for already-completed archived games beyond preserving the user's recorded first completion/result.
