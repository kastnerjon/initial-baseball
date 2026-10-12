# Daily Nine — move cumulative score into the at-bat card

Date: 2026-10-11. Scope: one presentation-only PR.

## Scope contract
- Goal: remove the separate progress-row SCORE and AT-BAT x OF 9 caption, and show the live points-v4 cumulative `Score: N` in the card header where `Who is the player?` appeared.
- Owner: `apps/web` presentation; the engine's points-v4 score stays authoritative.
- In scope: remove redundant tracker score prop/markup/CSS; forward preexisting displayedPoints.points to active and resolved card headers; focused rendering tests; canonical product documentation.
- Out of scope: scoreboard, progression circle behavior, hints, scoring, result submission, Custom Nine player page, historical points-v3 scoring behavior, database, general visual redesign.
- Acceptance: no separate progress score/AT-BAT caption, active and just-resolved cards show latest cumulative score including halves; strikes remain to the right; all nine progress circles stay; no answer leaks, 320px support; focused tests, typecheck/file-size, exact-head CI, READY Preview, bounded independent review, postmerge verification.
- Stop: any need to change engine scoring, game state, or other UI chat work requires another scope.

## Architecture
No new packages. Pure existing points passed as a numeric view prop; formatting only in web UI. The tracker still receives only position/completion data. Historical versions retain their own resolved header convention. No scoring duplication.

## Verification
Pending.
