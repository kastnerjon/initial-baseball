# Daily Nine scorecard/share average

Status: final points-native presentation follow-up after PR #231
Date: 2026-09-22

## Scope contract

- **Goal:** make Daily Nine user-facing result presentation consistently points-native wherever personal performance is shown or compared.
- **Owning layer:** `apps/web` presentation, reusing existing engine scoring authority and existing comparison reads.
- **In scope:** immediate terminal result uses `N PTS` rather than `Outcome HR/K/...`; ongoing/completed private rows remain initials + answer + personal AB points + `AVG x.x`; spoiler-safe per-AB share rows remain `BB: 0 • AVG: 7.0`; completed private headline becomes `X PTS • AVG Y.Y` when the whole-game AVG is displayable and `X PTS` otherwise; share header uses the same whole-game line; BEAT/sample-status remain secondary and keep existing thresholds; mobile private rows stay single-line; focused tests and canonical docs.
- **Out of scope:** scoring-rule changes, new score calculations, new persisted scorecard fields, Supabase/API/shared contract changes, comparison population or threshold changes, onset-of-AB AVG display, baseball-style `.700` notation, Classic presentation changes, or unrelated browser/mobile verification.
- **Acceptance checks:** no Daily Nine terminal/completed/share personal-performance surface uses `HR/3B/2B/1B/BB/K` as the user's score; terminal strikeout displays `0 PTS`; successful terminal display uses existing engine-derived points; completed private/share header displays `X PTS • AVG Y.Y` with current completed comparison data; withheld/unavailable AVG leaves `X PTS`; BEAT still appears only at 20+ completions; Classic remains baseball-native; focused tests, typecheck, file-size/full CI and exact-head Preview pass.
- **Stop conditions:** any need to change scoring semantics, portable native facts, persistence, result submission, comparison API/provider or Classic rules becomes separate work.

## Product semantics

Daily Nine has native baseball outcome facts because the game engine still needs them, but points-v3 scoring is not one-to-one with those outcomes. User-facing personal performance therefore speaks in points.

Immediate terminal result:

`Score   4 PTS`

not:

`Outcome   3B`

Private per-AB scorecard:

`BB   Barry Bonds   0   AVG 7.0`

Spoiler-safe per-AB share output:

`BB: 0 • AVG: 7.0`

Completed private/share headline:

`38 PTS • AVG 32.5`

When whole-game comparison is loading, unavailable or has fewer than two completed observations, the headline remains `38 PTS`; existing note text explains the comparison state. BEAT remains secondary and appears only under the existing 20-completion threshold.

## Personal score authority

No new personal-score state is stored.

Each resolved Daily Nine AB already persists the native terminal facts required by scoring:

- outcome;
- hints revealed;
- wrong guesses;
- resolution;
- pitch identity.

The web presentation passes those facts through the existing engine `getDailyAtBatPoints` rule. This is the same scoring authority used by at-bat result validation. Therefore terminal display and refresh/restore scorecards use one scoring authority without translating baseball outcome into points inside React.

Classic remains baseball-native.

## Comparison read lifecycle

The existing comparison lifecycle remains unchanged:

1. active exact-pitch comparison may prefetch while hidden;
2. terminal own points reveal the existing read state without restarting it;
3. scorecard rows may read/refill current exact-pitch aggregates asynchronously;
4. 0–1 observations withhold AVG;
5. completed-game comparison uses the existing whole-game aggregate and thresholds;
6. BEAT remains strict-lower and appears only at 20+ completed results;
7. comparison never blocks Guess, Give Up, Next, result delivery or sharing.

## Share safety

Portable `DailyShareResult` and engine `formatDailyShareText` remain unchanged as native/base representations.

For Daily Nine only, web presentation transforms that base into points-native copy:

- base header such as `38/63 PTS · 1 K` becomes `38 PTS • AVG 32.5` when AVG is displayable, otherwise `38 PTS`;
- base per-AB `BB: K` becomes `BB: 0 • AVG: 7.0` when AVG is displayable, otherwise `BB: 0`.

No player answer name, raw observation, participant identifier or private browser fact enters the share text.

## Mobile layout

Daily Nine point-comparison rows keep four columns on one line:

1. initials;
2. player answer;
3. personal AB points;
4. AVG.

The answer column owns flexible width and truncates with ellipsis before score/AVG wrap.

## Documentation impact

Reconcile START-HERE, todo, architecture and the comparison roadmap so Daily Nine's authoritative presentation rule is points-native while Classic remains baseball-native.
