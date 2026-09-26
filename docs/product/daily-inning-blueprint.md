# Daily Inning end-to-end blueprint

Status: Living product source of truth  
Last updated: 2026-09-23

## Product decision

Initial Baseball currently exposes **Daily Nine** as the normal/default browser game. **Classic Inning** remains a distinct implemented beta game over the same daily baseball puzzle, but it is hidden by default through a server-only web availability setting. This is a reversible presentation/route decision, not deletion: Classic rules, saves, results, comparison infrastructure, and data remain intact. Shared lineup content is a current product choice, not a permanent identity constraint.

Current Daily numbering is beta and is not the permanent historical sequence. At a later explicit launch decision, permanent numbering restarts at **Daily #1** and prior beta history is not imported into the public archive. Detailed settled direction: `docs/product/beta-launch-results-archive.md`.

Future themed, decade, team, custom, native, or head-to-head experiences may reuse the same systems but are not committed launch scope.

## Core promise

A player should understand the game quickly, complete a session in a few minutes, learn from canonical reveals, compare the result, and share spoiler-safe output. Baseball knowledge should matter more than luck. The game should feel immediate, accurate, clean, and recognizably baseball.

### Recognizability

Standard Daily should not create difficulty through arbitrary obscurity. Except for a possible final deep-challenge slot, a reveal should normally prompt: **“I could have gotten that.”** Challenge should come from recall, initials, hint timing, and uncertainty.

Detailed content direction: `docs/product/lineup-content-system.md`.

## Implemented gameplay loop

1. Everyone receives the same nine-player puzzle for the Pacific Daily date.
2. Each at-bat starts with initials.
3. All four hints for the active batter are already authorized and local before the at-bat appears.
4. Pressing Hint reveals the next local value immediately and adopts its signed reveal-depth checkpoint; it does not call the network.
5. Under the current `points-v3` Daily Nine policy, each at-bat starts at 7 points; every revealed hint and wrong guess costs 1 point.
6. Three wrong guesses—or Give Up—produces K and 0 points.
7. The resolved at-bat shows both the baseball outcome and the points awarded before the player reveal.
8. Resolution reveals the canonical current player and supplies the next batter’s authorized hint bundle.
9. `points-v3` continues through all nine scheduled at-bats.
10. Completion produces a score out of 63 and spoiler-safe initials/outcome sharing.

Player-facing Daily Nine explanation: “Each at-bat is worth up to 7 points. Every hint or wrong guess costs 1 point. Three wrong guesses—or Give Up—score 0 points. Play all 9 at-bats for up to 63 points.”

Compatible `points-v1` sessions retain `5/4/3/2/1/0` and a 45-point maximum. Compatible pre-ruleset sessions remain `legacy-inning-v1` and retain their prior three-out behavior.

## Alternate beta game: Classic Inning

Daily Nine remains the default points-v3 game at `/`. Classic Inning uses `classic-inning-v1`: the same ordered daily nine, runner advancement and run scoring, ending at three outs or nine at-bats. Its implementation is retained, but normal web availability defaults OFF. While `CLASSIC_INNING_ENABLED` is absent or not exactly `true`, no Daily/Classic mode navigation is rendered and `/classic` redirects to `/` before Classic bootstrap composition. Setting it to `true` restores the existing route and navigation without changing Classic code or stored data. Classic browser saves/reset remain isolated from the existing default Daily storage key, and its results/shares remain game/ruleset-specific.

Daily Nine and Classic remain independently modeled games, not two score views of one completion. Their result/comparison populations never mix. Hiding Classic does not delete or reinterpret prior Classic saves, results, comparison infrastructure, or rules. The owner may later re-enable Classic, remove it separately, or separate the lineups; current infrastructure preserves those seams without building a generic mode framework.


Daily Nine's in-app completed-at-bat scorecard shows initials, the revealed player name, personal score, and same-at-bat average. Copied/share text deliberately omits player names so sharing does not reveal answers.

The canonical hitter reveal uses the supported career and season column order `AB, R, H, HR, RBI, SB, BA, OBP, SLG, OPS`. Two-way players retain a separate pitching table, whose current column order is unchanged. Hint 4 is generated from structured career stats rather than the legacy preformatted stat line. Its compact hitter subset is `HR, RBI, SB, BA, OBP`; its pitcher subset is `W, L, SV, ERA, WHIP, K`, with `SV` omitted when unavailable. Both subsets preserve the corresponding reveal's relative order.

## Hint and answer boundary

Current-batter hints are gameplay inputs, not answers, and may be present in browser memory/initial props. The browser must not receive:

- canonical answer IDs or names before terminal resolution;
- canonical reveal records before terminal resolution;
- unrelated future-batter hints;
- credentials or service-role data.

Bootstrap contains only batter one’s bundle. Incorrect guesses refresh the same-pitch bundle with updated signed strike claims. Correct/K/Give Up responses may provide only the next pitch’s bundle. Saved progression hydrates only its verified current pitch.

A technical user can inspect all current hints before clicking them. This is accepted for the anonymous noncompetitive launch model; stronger competition requires a new architecture decision.

## Scoring and result facts

The current `points-v3` Daily Nine beta policy awards max(0, 7 - hints revealed - wrong guesses) for correct resolutions and 0 for a third wrong guess or Give Up. The earlier `points-v2` policy (`4/3/2/1/0.5/0`) and `points-v1` policy remain supported for already-started signed or saved sessions. Stable raw at-bat facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/strikeout/Give Up resolution. Ruleset version flows through token, browser state, result, and share contracts. Future scoring changes require a new version rather than rewriting completed results.

The portable shared/engine layer now also defines `points-v4`: HR 4, 3B 3, 2B 2, 1B 1, BB 0.5, K/Give Up 0; wrong guesses one and two do not deduct, while the third wrong guess is K. Nine at-bats span 0 through 36 in 0.5-point steps. Portable result validation, exact numeric storage, server result-write preflights, and server-only comparison reads support v4, but this definition is still not a live switch: `CURRENT_DAILY_RULESET_VERSION`, browser gameplay/result production, comparison HTTP/browser acceptance, scorecards/shares, and public gameplay remain points-v3 until later rollout work.

`points-v3` is not yet frozen as the permanent broad-launch scoring contract; that decision follows beta game selection. Completed-result persistence must therefore retain ruleset identity and raw facts.

## Daily puzzle lifecycle

Editorial records move through `draft`, `scheduled`, `published`, and `archived`. The final puzzle is the exact ordered nine canonical IDs. Ordinary editing cannot change published/archived answers.

Current beta puzzle numbers are disposable. At an explicitly chosen broad-launch epoch, permanent numbering restarts at Daily #1. From that point, every issued Daily is frozen and remains replayable/shareable in the archive; later generator/profile changes cannot silently change historical lineups. The archive begins at permanent Daily #1 rather than importing current beta history.

## Lineup content model

Lineups are recipe-driven. A recipe combines slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and optional diversity constraints. Standard Daily is one recipe. The generator proposes; the editor reviews, replaces, validates, and schedules the exact nine.

Statistical accomplishment is not recognizability. The current weighted-stat ranking is not an acceptable final Standard Daily content system.

## Current surfaces

- Daily Nine at `/` as the normal/default game; Classic implementation retained behind server-only availability, with `/classic` redirecting to `/` and no mode navigation while disabled;
- isolated Classic/default browser saves and game-safe reset/refresh restoration retained for reversible Classic restoration;
- point-focused Daily Nine scorebug and all-nine game;
- Classic runs/hits/bases/outs scorebug and three-out-or-nine-batter completion;
- resolved outcome plus awarded-point display;
- local, immediate active-batter Hint actions;
- canonical search/guess flow;
- post-at-bat career and season reveal;
- private scorecard rows with initials, resolved canonical answer, and outcome;
- separate spoiler-safe share card with an upper-right Copy button;
- local refresh recovery with token-authorized hint hydration;
- authorized seven-day editorial administration.

## Visual system

The public Daily surface uses a **compact baseball scorebook**: warm off-white paper, forest green, muted red, and restrained serif typography for the masthead, initials and player name. This refines the heritage baseline after screenshot review; readability and the main guessing interaction take priority over decoration.

Presentation rules:

- compact masthead with one edition number and a small expandable help control; no full-width instruction row, double borders, ruled textures, gradients or nested decorative cards;
- a single 960px maximum content rail keeps the masthead, scorebug, playing surface, scorecard, share card, and footer aligned; the rail remains fluid below that width on smaller screens;
- a non-sticky compact status row shows At bat, Points possible this AB, Points so far, and Strikeouts in that order with equal-width columns; accumulated points omit the overall denominator, while legacy sessions retain runs/hits/bases/outs and never receive point copy;
- terminal status renders existing pending-advance totals immediately, without recomputing rules in React;
- incorrect feedback presents the Incorrect status and remaining-strikes message without a separate call label;
- current strikes appear once beside the guessing interaction with an accessible numeric label;
- regular-weight system sans serif for body text, controls and data; display serif is reserved for a few focal points;
- the initials, hints and guess input remain close together; Submit Guess is the primary action, Hint is secondary, and Give Up is quiet; controls keep at least 44px tap targets and text inputs remain 16px;
- completed-at-bat history follows the playing surface; scorecard rows use compact left-aligned columns for initials, canonical answer, and outcome; optional history never pushes the current interaction down;
- terminal outcome/awarded points and Next At Bat precede the reveal and expandable season tables, preserving continuation when tables are long;
- search suggestions overlay the flow and selecting a player suppresses the empty-results dropdown; unique names remain names only and genuine duplicates retain years, without position/team clues;
- no placeholder distributions or unsourced award/leader emphasis; future percentile/comparison UI follows the same restrained hierarchy;
- presentation never changes scoring, server answer authority, canonical facts, persistence, publication, or progression.

Statistics use compact right-aligned tabular numerals, regular-weight season values, a distinguished career total row, subtle row rules, and expandable season details. Season and Team are separate columns; all teams in a multi-team season remain visible. Tables scroll within keyboard-focusable labeled regions, with sticky headers and Season/Team identifiers. Column abbreviations provide definitions. Missing values remain distinct from known zero; rendering does not infer facts or add unsourced statistics.

Browser verification must cover common phone/tablet/desktop widths, local table overflow, search overlays and pending states, terminal/reveal/continuation, refresh and completion. Emulated browser checks do not substitute for physical iPhone timing/touch QA.

## Completed results and comparison direction

Whole-game aggregation uses one compact idempotent completed-game submission from native raw facts, stable puzzle identity, and ruleset identity. The server validates puzzle identity/internal consistency and derives summaries rather than trusting client-submitted totals. The approved AB extension adds terminal observations, not per-hint/per-guess writes.

Daily Nine v1 shows points versus the same at-bat average after each terminal resolution, asynchronously without blocking Next At Bat. AB populations include received resolved-AB observations from partial games; whole-game averages use completed results only. The final scorecard combines these independent populations and shows the percentage of finishers scoring strictly lower, subject to minimum samples. Comparisons may be briefly cached and refresh independently of immutable personal results. Classic remains separate and baseball-native; no overall Classic ranking is approved. Details: `docs/product/beta-launch-results-archive.md` and `tasks/plans/resolved-at-bat-comparison.md`.

"Reset today’s results" is beta-only and must leave the public UI before broad launch. Any retained admin/test mechanism must not contribute to comparisons.

## Archive and personal history direction

The permanent archive begins only after the explicit launch reset to Daily #1. Each prior permanent Daily remains playable/shareable. While both games remain supported, an archived Daily can offer each independently and track completion separately.

The initial no-account product remembers played Dailies and the user's recorded result on that browser/device. Archive saves/history are keyed by stable Daily identity plus game/ruleset and must not overwrite the current Daily save. Cross-device history remains deferred until accounts.

## Required before broad launch

- full authenticated admin/public-runtime production QA;
- real-browser gameplay and refresh QA on common iPhone/iPad sizes;
- compact completed-result persistence plus same-Daily/same-ruleset comparison;
- permanent archive/history infrastructure beginning from the eventual launch Daily #1;
- explicit choice of launch game, final launch rules, and launch date/numbering epoch;
- calibrated recognizable lineups;
- analytics/error monitoring;
- privacy/terms, canonical domain, and social metadata.

## Deferred

Accounts/cross-device history, public leaderboards, user-created or exposed theme libraries, native clients, head-to-head/social features, and payments. Classic-specific advanced analytics should also wait until beta feedback justifies retaining Classic.

## State and persistence

Anonymous visible state remains client-driven. Local storage restores puzzle/ruleset, at-bat state, raw facts, score, and opaque token. Daily Nine retains the existing date-keyed storage namespace for compatibility; Classic uses a distinct game namespace for the same puzzle date, so switching or resetting one game does not overwrite the other. The hint bundle is not required as durable state; a verified saved token may hydrate the exact current bundle before interaction.

Aggregate results use a compact idempotent completed-game write plus the approved immutable terminal-AB observations; no per-hint/per-guess writes. Future archive history is local/browser-device history unless/until accounts are introduced.

## Scorecard and sharing

The scorecard uses canonical display names already delivered at terminal resolution, including correct guesses, third strikes, and Give Up. It shows only faced/resolved players. Browser-local names survive refresh, including the pending Next At Bat screen, and reset with that local session. Older saves without retained names show “Answer unavailable”; no missing-answer fetch is introduced.

The separate share card and copied text remain spoiler-free: initials, outcomes, score, puzzle metadata, and URL only. Copy provides success feedback or a manual-selection fallback when clipboard permission is unavailable. Daily Nine shares point to `/`; Classic shares point to `/classic`, and the share formatter labels the ruleset’s game.

Permanent archived Dailies remain shareable and identify the stable Daily number/game without exposing answers.

## Statistics and reveal

Career summary remains separate from chronological regular-season rows. Multi-team seasons retain every team. Known zero and unavailable remain distinct. Rate statistics are not inferred from partial components. WAR, All-Star selections, awards, voting, and leaders require reproducible approved sources; approved Baseball Reference WAR is labeled `bWAR`.

## Architecture constraints

Rules stay outside React/routes; facts stay in baseball-data; scoring stays in engine/shared; recipes stay in Daily; web owns transport, authorization, browser state, and adapters; Supabase is a provider, not a rule owner. No microservices, queues, replay caches, or per-hint/per-guess persistence for launch. Results and archive infrastructure are game-aware but must not introduce a generic plugin framework or force permanent support for both beta games.

## Launch-ready definition

The winning beta game is explicitly chosen; permanent numbering/launch epoch is explicit; lineups are recognizable and editorially reviewable; Hint feels instantaneous; scoring/versioning is coherent; refresh is reliable; search/reveals are accurate; results and sharing are spoiler-safe; comparison works with one immutable observation per resolved AB and no per-hint/per-guess writes; the permanent archive/history works from Daily #1; answer boundaries hold; mobile layouts are polished; deployment/legal/domain/monitoring basics are complete.

## Change rule

Implementation and canonical docs change together. Approved future behavior must be labeled rather than presented as live.
