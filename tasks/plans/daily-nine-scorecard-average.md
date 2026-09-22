# Daily Nine scorecard/share average

Status: issue #216 final presentation correction after PR #230
Date: 2026-09-22

## Scope contract

- **Goal:** compare the user's awarded points for each resolved Daily Nine at-bat against the crowd's average points for that same at-bat on the ongoing private scorecard, completed private scorecard and spoiler-safe share output.
- **Owning layer:** `apps/web` presentation, reusing existing engine scoring authority and browser comparison reads.
- **In scope:** derive a `pitchNumber -> awardedPoints` presentation map from persisted `completedAtBats` through the existing engine `getDailyAtBatPoints` function; replace Daily Nine baseball outcome presentation in private/share scorecard rows with personal AB points; preserve the existing exact-pitch AVG read and 0–1 withholding policy; format private rows as initials + answer + personal score + `AVG x.x`; format share rows like `BB: 0 • AVG: 7.0`; keep all four private fields on one mobile line with player-name truncation as the pressure-release valve; focused tests and canonical docs.
- **Out of scope:** any scoring-rule change, new scoring calculation, new persisted scorecard field, Supabase/API/shared contract changes, comparison population changes, onset-of-AB AVG display, baseball-style `.700` notation, completed-game YOU / AVG / BEAT changes, Classic presentation changes, or unrelated browser/mobile verification.
- **Acceptance checks:** a strikeout/give-up worth 0 renders as personal score `0` rather than `K`; a successful AB uses the engine-computed awarded points from its stored terminal facts; share output uses personal points and never answer names; 0–1 comparison samples omit AVG while retaining personal score; Daily Nine private mobile rows stay one line; Classic still shows baseball outcomes; focused tests, typecheck, file-size/full CI and exact-head Preview pass.
- **Stop conditions:** any need to change scoring semantics, portable completed-at-bat facts, persistence schema, result submission, comparison API/provider or Classic rules becomes separate work.

## Product semantics

The scorecard comparison is:

`YOUR AB POINTS vs CROWD AB AVG`

not:

`BASEBALL OUTCOME vs CROWD AB AVG`.

Examples:

Private Daily Nine scorecard:

`BB   Barry Bonds   0   AVG 7.0`

Spoiler-safe share output:

`BB: 0 • AVG: 7.0`

When the comparison population has fewer than two observations, the user's score still appears but AVG is omitted.

## Personal score authority

No new personal-score state is stored.

Each resolved Daily Nine AB already persists the native terminal facts required by scoring:

- outcome;
- hints revealed;
- wrong guesses;
- resolution;
- pitch identity.

The web scorecard passes those facts back through the existing engine `getDailyAtBatPoints` rule. This is the same scoring authority used by at-bat result validation. Therefore refresh/restore reconstructs the same personal AB score without duplicating formulas or translating `K/HR/etc.` into points in React.

Classic does not receive this points map and continues to render baseball outcomes.

## Comparison read lifecycle

The existing scorecard comparison lifecycle remains unchanged:

1. each completed pitch may read the current exact-pitch aggregate asynchronously;
2. 0–1 observations withhold AVG;
3. one bounded delayed retry may catch the independent result-write race;
4. low-sample/unavailable rows may refresh as later ABs complete;
5. restore/refill is capped at three concurrent reads;
6. comparison never blocks Guess, Give Up, Next, result delivery or sharing.

## Share safety

The engine-owned `DailyShareResult` and `formatDailyShareText` remain unchanged and portable. Their baseball-outcome pitch lines remain the base representation.

For Daily Nine only, web presentation replaces the displayed/share-copied pitch token with the engine-derived personal points and appends AVG when displayable:

`BB: K` -> `BB: 0 • AVG: 7.0`

No player answer name, raw observation, participant identifier or completed-game BEAT value enters the share text.

## Mobile layout

Daily Nine point-comparison rows have four columns:

1. initials;
2. player answer;
3. personal AB points;
4. AVG.

All four stay on one line on narrow screens. The answer column owns flexible width and truncates with ellipsis before score/AVG are allowed to wrap.

## Documentation impact

Reconcile START-HERE, todo, architecture and the comparison roadmap so the authoritative scorecard contract is personal AB points versus crowd AB AVG.
