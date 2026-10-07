# Pregame completed-game average

Status: Implementation proposed for bounded PR release.

## Scope contract

- **Goal:** display Daily Nine scoreboard TOTAL AVG from other completed games before all nine ABs are finished.
- **Owning layer:** `apps/web` comparison hook and scoreboard presentation.
- **In scope:** request existing completed aggregate after save hydration without requiring own final score; use null for unfinished own score; render AVG during play; keep BEAT/above-below final-only; focused tests and canonical docs.
- **Out of scope:** scoring, data/provider/backend contract, result writes, sample thresholds, persistence, exclusion transport, Classic, archive issuance, CSS redesign, new dependencies.
- **Acceptance:** one-other-result TOTAL AVG displays starting AB 1; loading ellipsis, no-other/unavailable dash; no premature personal performance judgment; completed score refresh preserves strict-lower BEAT; current/archive share exact-puzzle/ruleset and first-result exclusion; no blocking/leaks; exact-head CI, fresh-eyes review, READY Preview, production verification.
- **Stop conditions:** need to alter domain rules, provider, database, persistence, authorization, infrastructure or add dependencies.

## Architecture / effects

Only the existing web comparison read lifecycle and derived presentation change. The same GET/exclusion identity is used before and after completion. Before completion ownPoints is null, never zero, so BEAT/status cannot be computed. Finishing the game triggers the existing score-bound completed comparison refresh for the final BEAT/green-red display. This adds at most one earlier nonblocking completed-game GET; neither results nor writes change.
