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
5. Under the current `points-v4` Daily Nine policy, a correct guess scores 4 points on initials, then 3, 2, 1, or 0.5 after hints 1–4; wrong guesses one and two do not deduct.
6. Three wrong guesses—or Give Up—produces K and 0 points.
7. The resolved at-bat shows both the baseball outcome and the points awarded before the player reveal.
8. Resolution reveals the canonical current player and supplies the next batter’s authorized hint bundle.
9. `points-v4` continues through all nine scheduled at-bats.
10. Completion produces a score out of 36, in 0.5-point steps, and spoiler-safe initials/outcome sharing.

Player-facing Daily Nine explanation: “Correct on initials is worth 4 points. Hints 1–4 are worth 3, 2, 1, then 0.5. Wrong guesses one and two do not reduce your score. A third wrong guess—or Give Up—scores 0. Play all 9 at-bats for up to 36 points.”

Compatible `points-v1` sessions retain `5/4/3/2/1/0` and a 45-point maximum. Compatible pre-ruleset sessions remain `legacy-inning-v1` and retain their prior three-out behavior.

## Alternate beta game: Classic Inning

Daily Nine remains the default points-v4 game at `/`. Classic Inning uses `classic-inning-v1`: the same ordered daily nine, runner advancement and run scoring, ending at three outs or nine at-bats. Its implementation is retained, but normal web availability defaults OFF. While `CLASSIC_INNING_ENABLED` is absent or not exactly `true`, no Daily/Classic mode navigation is rendered and `/classic` redirects to `/` before Classic bootstrap composition. Setting it to `true` restores the existing route and navigation without changing Classic code or stored data. Classic browser saves/reset remain isolated from the existing default Daily storage key, and its results/shares remain game/ruleset-specific.

Daily Nine and Classic remain independently modeled games, not two score views of one completion. Their result/comparison populations never mix. Hiding Classic does not delete or reinterpret prior Classic saves, results, comparison infrastructure, or rules. The owner may later re-enable Classic, remove it separately, or separate the lineups; current infrastructure preserves those seams without building a generic mode framework.


The shared points-v4 six-outcome score distribution presents both the percentage and actual number of peer answers above each bar; its legend explains "% of answers / # answers". The player's scored bucket remains dark, outlined and marked YOU even if no other peer achieved that bucket. Omit the visible "ties aren't counted as beaten" copy in the expanded chart, terminal at-bat fallback and final-score peer note, without changing the strict-lower BEAT calculation. This is a display-only refinement shared by terminal comparison and expanded Your Nine rows.

For current points-v4 gameplay, the owner-approved "Your Nine" performance board supersedes both scoreboards visually: the top horizontal inning scoreboard is not rendered, and the bottom five-column Scoreboard is replaced with a single compact list under gameplay (and on the final results screen). It emphasizes completed outcomes and awarded points, shows at-bat AVG and strict-lower BEAT % plus a 0–4-point visual bar, includes running total, progress and the pregame authoritative completed-game average, and adds a default-OFF "Reveal players" switch for authorized resolved names beside initials. A current-at-bat marker is shown without future names; unrevealed/unplayed names never enter markup. Old scoreboards, CSS, and their presentation code are retained behind one reversible points-v4-only presentation switch; Classic and historical points-v3 stay unchanged. Copied shares are unaffected. Each completed Your Nine row can be expanded by keyboard/tap to show the already-implemented six-category exact-slot peer score distribution inline, with only one row expanded at a time. The completed-row chart reuses the same source histogram and strict-lower semantics as the terminal at-bat display, makes no new API calls, and shows a loading/empty/unavailable message rather than inferring distributions when peer data cannot supply one. Current and upcoming at-bats remain non-interactive.

The retained legacy Daily Nine's bottom detailed Scoreboard presents AB number, initials (with optional session-local Reveal answers for already resolved names), combined OUTCOME-SCORE, per-AB AVG and strict-lower BEAT %, and a TOTAL row with personal accumulated points, authoritative completed-game AVG, and final-only completed-game BEAT %. Missing comparisons show —. The original top nine-column Scoreboard remains until the separate approved nine-circle progress-tracker PR. Owner visual feedback on the first bottom Scoreboard release selected a restrained bordered light card, prominent serif heading, same-line answer toggle, compact ruled rows and rounded pale-green TOTAL strip; the during-play disclosure remains native and keyboard accessible. On phones all five bottom columns must be visible without horizontal scrolling: compact AB, adequate Player, moderate Result (desktop Outcome-Score), compact AVG and BEAT %. Reveal answers defaults OFF with initials only; ON renders `BH - Bryce Harper`, with the resolved canonical name beginning beside initials and long names wrapping only within the answer subcolumn. Column and TOTAL metric alignment remain consistent. Copied/share text deliberately omits player names and is unchanged.

The canonical hitter reveal uses the supported career and season column order `AB, R, H, HR, RBI, SB, BA, OBP, SLG, OPS`. Two-way players retain a separate pitching table, whose current column order is unchanged. Hint 4 is generated from structured career stats rather than the legacy preformatted stat line. Its compact hitter subset is `HR, RBI, SB, BA, OBP`; its pitcher subset is `W, L, SV, ERA, WHIP, K`, with `SV` omitted when unavailable. Both subsets preserve the corresponding reveal's relative order.

The completed Daily Nine summary uses a small `Daily #N` heading and three equal-width cards: `FINAL SCORE` (personal points), `AVERAGE` (other completed results), and `BEAT` (strict-lower percentage). The existing comparison note and above/below-average indication remain; missing or pending comparisons show dashes. There is no large Game Complete heading or checkmark on Daily Nine. Classic completion, scorecard, and sharing are unchanged.

The Daily Nine copied share text reports completed-game points, average, and strict-lower BEAT % when comparison data exist. Its compact per-at-bat initials-only table has SCORE, AVG, and BEAT % columns; unavailable individual values display —, and unavailable overall metrics are omitted. Sharing continues to exclude player names, and no comparison or scoring calculations are added to UI.

The resolved Daily Nine points-v4 at-bat comparison replaces the redundant YOU/AVG/BEAT metric block with a compact, accessible six-bar score distribution (K 0, BB 0.5, 1B 1, 2B 2, 3B 3, HR 4) with the player's exact outcome highlighted. Percentages and sample size come only from the existing exact-puzzle, exact-ruleset, first-result-excluded peer histogram. The BEAT figure retains strictly-lower semantics (ties not beaten); a missing, incompatible or historical points-v3 histogram does not create a fabricated six-outcome chart. Its subtitle holds the average points and other-result count; the existing below-chart strict-lower BEAT summary remains, without duplicating figures above. When the histogram is unavailable or incompatible (including points-v3), the prior textual YOU/AVG/BEAT comparison remains visible so no information is lost. The histogram remains hidden until the active at-bat resolves, and comparison reads/scoring/results are unchanged.

## Hint and answer boundary

Current-batter hints are gameplay inputs, not answers, and may be present in browser memory/initial props. The browser must not receive:

- canonical answer IDs or names before terminal resolution;
- canonical reveal records before terminal resolution;
- unrelated future-batter hints;
- credentials or service-role data.

Bootstrap contains only batter one’s bundle. Incorrect guesses refresh the same-pitch bundle with updated signed strike claims. Correct/K/Give Up responses may provide only the next pitch’s bundle. Saved progression hydrates only its verified current pitch.

A technical user can inspect all current hints before clicking them. This is accepted for the anonymous noncompetitive launch model; stronger competition requires a new architecture decision.

## Scoring and result facts

Historical `points-v3` awards max(0, 7 - hints revealed - wrong guesses) for correct resolutions and 0 for a third wrong guess or Give Up. `points-v2` and `points-v1` remain compatibility-only for already-started signed or saved sessions. Stable raw at-bat facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/strikeout/Give Up resolution. Ruleset version flows through token, browser state, result, and share contracts. Future scoring changes require a new version rather than rewriting completed results.

The public Daily Nine now uses `points-v4`: HR 4, 3B 3, 2B 2, 1B 1, BB 0.5, K/Give Up 0; wrong guesses one and two do not deduct, while the third wrong guess is K. Its How to Play dialog uses a five-row, labeled outcome/points table by hint count, separately calls incorrect guesses strikes (first two free, third K), and explains nine ABs and the 36-point perfect game; historical v3 and Classic instructions remain distinct. Nine at-bats span 0 through 36 in 0.5-point steps. Exact-version save/result/comparison infrastructure and the ruleset-aware How-to modal preserve historical v3 sessions while new public sessions use v4. The September 27 Pacific activation was explicitly allowed mid-puzzle, so that date may contain both v3 and v4 populations without merging them.

`points-v4` is the current beta scoring contract but is not automatically the permanent broad-launch contract; that decision still follows beta game selection. Completed-result persistence therefore retains exact ruleset identity and raw facts.

## Daily puzzle lifecycle

Editorial records move through `draft`, `scheduled`, `published`, and `archived`. The final puzzle is the exact ordered nine canonical IDs. Ordinary editing cannot change published/archived answers.

For the disposable archive-beta test series beginning October 4, 2026, authenticated publication also issues and verifies the immutable archive copy. Publication commits first; a failed archive write/read-back remains retryable through Verify archive copy without republishing. Scheduling does not freeze content. Archiving verifies the beta copy before retiring the published retry path; failure keeps the lineup published. Immutable-content conflicts require editorial review and return sanitized 409. This adds no public archive availability or permanent launch epoch.

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

## Private admin score grid

The authorized owner can open Attempt scores from the existing lineup dashboard to inspect anonymous attempts as rows and AB 1–9 scores as columns. Date, exact lineup edition and scoring version are selectable; each edition is inspected separately. Partial games, missing scores, completion-only facts and known October 6 beta seeds are distinguished. Received-AB points, completed points and receipt times are separate. Optional CSV exports the displayed bounded page. This read-only feature does not modify gameplay, averages or result delivery; named rows/cross-device ownership still require accounts, and deletion/moderation is not part of this screen.

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
- autocomplete requires a name fragment beyond separated initials: `a r` and `o a` return no suggestions; surnames, normal partial names, aliases and names such as `A. J. Reed` remain searchable;
- search suggestions overlay the flow and selecting a player suppresses the empty-results dropdown; unique names remain names only and genuine duplicates retain years, without position/team clues;
- no placeholder distributions or unsourced award/leader emphasis; future percentile/comparison UI follows the same restrained hierarchy;
- presentation never changes scoring, server answer authority, canonical facts, persistence, publication, or progression.

Statistics use compact right-aligned tabular numerals, regular-weight season values, a distinguished career total row, subtle row rules, and expandable season details. Season and Team are separate columns; all teams in a multi-team season remain visible. Tables scroll within keyboard-focusable labeled regions, with sticky headers and Season/Team identifiers. Column abbreviations provide definitions. Missing values remain distinct from known zero; rendering does not infer facts or add unsourced statistics.

Browser verification must cover common phone/tablet/desktop widths, local table overflow, search overlays and pending states, terminal/reveal/continuation, refresh and completion. Emulated browser checks do not substitute for physical iPhone timing/touch QA.

## Completed results and comparison direction

Whole-game aggregation uses one compact idempotent completed-game submission from native raw facts, stable puzzle identity, and ruleset identity. The server validates puzzle identity/internal consistency and derives summaries rather than trusting client-submitted totals. The approved AB extension adds terminal observations, not per-hint/per-guess writes.

Daily Nine v1 preloads all nine exact-slot at-bat comparison averages after saved-game hydration through bounded nonblocking reads, so displayable AVGs may appear in the inning scoreboard before their at-bats are played. Terminal YOU / AVG reuses the same cached slot rather than restarting the read. Loading is shown as `…`; genuinely unavailable or sample-withheld values remain `—`. AB populations include received resolved-AB observations from partial games; whole-game averages use completed results only, and TOTAL AVG is always the separate authoritative completed-game comparison rather than per-AB arithmetic. After browser save hydration it begins loading during play and can show from AB 1; personal TOTAL remains points earned so far. Zero-other results remain withheld and BEAT/above-below judgment awaits personal completion. The bottom Scoreboard combines these independent populations and shows the percentage of finishers scoring strictly lower, subject to minimum samples. Comparisons may be briefly cached and refresh independently of immutable personal results. Classic remains separate and baseball-native; no overall Classic ranking is approved. Details: `docs/product/beta-launch-results-archive.md` and `tasks/plans/resolved-at-bat-comparison.md`.

"Reset today’s results" is beta-only and must leave the public UI before broad launch. Any retained admin/test mechanism must not contribute to comparisons.

## Archive and personal history direction

October 7 owner requirement: each completed Daily automatically acquires its archive copy after the Pacific day ends. Stored scheduled lineups are first published to lock their final order; the archive preserves exact issued players/clues and never regenerates an existing copy. Original Daily records remain published for delayed result delivery. Today/future lineups remain outside public archive play. Missing historical authority fails explicitly rather than inventing a past lineup. The app operation and private scheduler are deployed in separately reviewed releases. The active private job runs at 07:00/08:00 UTC to cover Pacific midnight in either DST state and retries completed-date catch-up; no site visit or owner click is required. Scope: `tasks/plans/automatic-archive-rollover.md`.

The disposable beta archive exposes only actually issued schema-2 puzzles through `/archive` and `/archive/N`, restricted to completed dates before the current Pacific date. It uses frozen batting order, initials and hints with current Daily Nine scoring. Each beta puzzle/ruleset has isolated browser progress, ownership and reset; completion is device-local and shares its exact archive URL with an explicit Archive beta label. Archive-beta result delivery uses its exact puzzle + points-v4 population. Comparison GET APIs and browser reads use explicit authoritative archive puzzle identity, exact played ruleset and durable first-result exclusion. Shared per-AB/final AVG and strict-lower BEAT need one other submitted result; zero stays unavailable and reads never block gameplay. Scope: `tasks/plans/archive-beta-comparison-browser.md`. The catalog lists the 60 most recent issued puzzles; older issued numbered URLs remain addressable. This is not permanent launch or a cross-device history feature. Scope: `tasks/plans/playable-archive-beta.md`.

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

Anonymous visible state remains client-driven. Local storage restores puzzle/ruleset, at-bat state, raw facts, score, and opaque token. Current points-v4 Daily Nine saves use date, ruleset, and exact public puzzle identity. Matching older date/ruleset saves remain readable; known different-puzzle saves are ignored, while unclassifiable values remain present/unusable to preserve contribution safeguards. Historical pre-v4 saves retain their existing namespace; Classic uses a distinct game namespace for the same puzzle date, so switching or resetting one game does not overwrite the other. The hint bundle is not required as durable state; a verified saved token may hydrate the exact current bundle before interaction.

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

## At-bat detail alignment

Hint content, the Reveal Next Hint button, and terminal YOU/AVG plus BEAT/status/sample-note rows use the established left-aligned presentation. The Hints/count header, player reveal and guess/action layout retain their existing alignment. This is CSS presentation only; scoring, comparison semantics and gameplay remain unchanged. The October 7 centered iteration in PR #324 was rejected after production review and reversed. Scope: `tasks/plans/restore-left-at-bat-details.md`.
