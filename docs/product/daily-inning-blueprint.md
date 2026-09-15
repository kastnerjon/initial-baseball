# Daily Inning end-to-end blueprint

Status: Living product source of truth  
Last updated: 2026-09-15

## Product decision

Initial Baseball currently has one committed product: **Daily Inning**, a browser-first daily baseball guessing game. Future themed, decade, team, custom, native, or head-to-head experiences may reuse the same systems but are not committed launch scope.

## Core promise

A player should understand the game quickly, complete nine players in a few minutes, learn from canonical reveals, compare the result, and share spoiler-safe output. Baseball knowledge should matter more than luck. The game should feel immediate, accurate, clean, and recognizably baseball.

### Recognizability

Standard Daily should not create difficulty through arbitrary obscurity. Except for a possible final deep-challenge slot, a reveal should normally prompt: **“I could have gotten that.”** Challenge should come from recall, initials, hint timing, and uncertainty.

Detailed content direction: `docs/product/lineup-content-system.md`.

## Implemented gameplay loop

1. Everyone receives the same nine-player puzzle for the Pacific Daily date.
2. Each at-bat starts with initials.
3. All four hints for the active batter are already authorized and local before the at-bat appears.
4. Pressing Hint reveals the next local value immediately and adopts its signed reveal-depth checkpoint; it does not call the network.
5. Under the current `points-v2` policy, correct outcomes and points are:
   - initials: HR, 4 points;
   - hint 1: 3B, 3 points;
   - hint 2: 2B, 2 points;
   - hint 3: 1B, 1 point;
   - hint 4: BB, 0.5 points.
6. Three wrong guesses or Give Up produces K and 0 points.
7. The resolved at-bat shows both the baseball outcome and the points awarded before the player reveal.
8. Resolution reveals the canonical current player and supplies the next batter’s authorized hint bundle.
9. `points-v2` continues through all nine scheduled at-bats.
10. Completion produces a score out of 36 and spoiler-safe initials/outcome sharing.

Compatible `points-v1` sessions retain `5/4/3/2/1/0` and a 45-point maximum. Compatible pre-ruleset sessions remain `legacy-inning-v1` and retain their prior three-out behavior.

## Approved alternate mode: Classic Inning

Daily Nine remains the default points-v2 game. Classic Inning uses classic-inning-v1: same ordered daily nine, runner advancement and run scoring, ending at three outs or nine at-bats. Players may play both modes, accepting the spoiler interaction. Only faced players appear in the scorecard. Results/shares identify the mode, and local sessions must remain separate. The portable policy is implemented; public mode selection and save isolation are the next integration work, not yet live. Legacy and points-v1 rules remain unchanged.

## Hint and answer boundary

Current-batter hints are gameplay inputs, not answers, and may be present in browser memory/initial props. The browser must not receive:

- canonical answer IDs or names before terminal resolution;
- canonical reveal records before terminal resolution;
- unrelated future-batter hints;
- credentials or service-role data.

Bootstrap contains only batter one’s bundle. Incorrect guesses refresh the same-pitch bundle with updated signed strike claims. Correct/K/Give Up responses may provide only the next pitch’s bundle. Saved progression hydrates only its verified current pitch.

A technical user can inspect all current hints before clicking them. This is accepted for the anonymous noncompetitive launch model; stronger competition requires a new architecture decision.

## Scoring and result facts

The current `points-v2` policy maps HR/3B/2B/1B/BB/K to `4/3/2/1/0.5/0`. The earlier `points-v1` policy remains supported for already-started signed or saved sessions. Stable raw at-bat facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/strikeout/Give Up resolution. Ruleset version flows through token, browser state, result, and share contracts. Future scoring changes require a new version rather than rewriting completed results.

## Daily puzzle lifecycle

Editorial records move through `draft`, `scheduled`, `published`, and `archived`. The final puzzle is the exact ordered nine canonical IDs. Ordinary editing cannot change published/archived answers. Archive/replay remains a future surface.

## Lineup content model

Lineups are recipe-driven. A recipe combines slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and optional diversity constraints. Standard Daily is one recipe. The generator proposes; the editor reviews, replaces, validates, and schedules the exact nine.

Statistical accomplishment is not recognizability. The current weighted-stat ranking is not an acceptable final Standard Daily content system.

## Current surfaces

- point-focused Daily scorebug and all-nine game;
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
- a centered playing surface up to 640px wide, with a wider resolved-player surface up to 960px for desktop statistics;
- a non-sticky compact status row shows the current at-bat number unambiguously, the ruleset-derived score/maximum and strikeouts; legacy sessions retain runs/hits/bases/outs and never receive point copy;
- terminal status renders existing pending-advance totals immediately, without recomputing rules in React;
- current strikes appear once beside the guessing interaction with an accessible numeric label;
- regular-weight system sans serif for body text, controls and data; display serif is reserved for a few focal points;
- the initials, hints and guess input remain close together; Submit Guess is the primary action, Hint is secondary, and Give Up is quiet; controls keep at least 44px tap targets and text inputs remain 16px;
- completed-at-bat history follows the playing surface; optional history never pushes the current interaction down;
- terminal outcome/awarded points and Next At Bat precede the reveal and expandable season tables, preserving continuation when tables are long;
- search suggestions overlay the flow and selecting a player suppresses the empty-results dropdown; unique names remain names only and genuine duplicates retain years, without position/team clues;
- no placeholder distributions or unsourced award/leader emphasis; future percentile/comparison UI follows the same restrained hierarchy;
- presentation never changes scoring, server answer authority, canonical facts, persistence, publication, or progression.

Statistics use compact right-aligned tabular numerals, regular-weight season values, a distinguished career total row, subtle row rules, and expandable season details. Season and Team are separate columns; all teams in a multi-team season remain visible. Tables scroll within keyboard-focusable labeled regions, with sticky headers and Season/Team identifiers. Column abbreviations provide definitions. Missing values remain distinct from known zero; rendering does not infer facts or add unsourced statistics.

Browser verification must cover common phone/tablet/desktop widths, local table overflow, search overlays and pending states, terminal/reveal/continuation, refresh and completion. Emulated browser checks do not substitute for physical iPhone timing/touch QA.

## Required before broad launch

- full authenticated admin/public-runtime production QA;
- real-browser all-nine and refresh QA on common iPhone/iPad sizes;
- compact completed-result persistence and same-puzzle/same-ruleset percentile;
- calibrated recognizable lineups;
- analytics/error monitoring;
- privacy/terms, canonical domain, and social metadata.

## Deferred

Accounts, streaks/cross-device history, public leaderboards, user-created or exposed theme libraries, native clients, head-to-head/social features, and payments.

## State and persistence

Anonymous visible state remains client-driven. Local storage restores puzzle/ruleset, at-bat state, raw facts, score, and opaque token. The hint bundle is not required as durable state; a verified saved token may hydrate the exact current bundle before interaction.

Future aggregate results use one compact idempotent completed-game write, not per-action writes.

## Scorecard and sharing

The scorecard uses canonical display names already delivered at terminal resolution, including correct guesses, third strikes, and Give Up. It shows only faced/resolved players. Browser-local names survive refresh, including the pending Next At Bat screen, and reset with that local session. Older saves without retained names show “Answer unavailable”; no missing-answer fetch is introduced.

The separate share card and copied text remain spoiler-free: initials, outcomes, score, puzzle metadata, and URL only. Copy provides success feedback or a manual-selection fallback when clipboard permission is unavailable.

## Statistics and reveal

Career summary remains separate from chronological regular-season rows. Multi-team seasons retain every team. Known zero and unavailable remain distinct. Rate statistics are not inferred from partial components. WAR, All-Star selections, awards, voting, and leaders require reproducible approved sources; approved Baseball Reference WAR is labeled `bWAR`.

## Architecture constraints

Rules stay outside React/routes; facts stay in baseball-data; scoring stays in engine/shared; recipes stay in Daily; web owns transport, authorization, browser state, and adapters; Supabase is a provider, not a rule owner. No microservices, queues, replay caches, or per-action persistence for launch.

## Launch-ready definition

Lineups are recognizable and editorially reviewable; Hint feels instantaneous; scoring/versioning is coherent; refresh is reliable; search/reveals are accurate; results and sharing are spoiler-safe; comparison works without per-action writes; answer boundaries hold; mobile layouts are polished; deployment/legal/domain/monitoring basics are complete.

## Change rule

Implementation and canonical docs change together. Approved future behavior must be labeled rather than presented as live.
