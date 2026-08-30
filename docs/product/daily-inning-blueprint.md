# Daily Inning end-to-end blueprint

Status: Living product source of truth  
Last updated: 2026-08-29

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
- completed-at-bat history and spoiler-safe point share;
- local refresh recovery with token-authorized hint hydration;
- authorized seven-day editorial administration.

## Visual system

The public Daily surface uses a **modern heritage scorecard** direction: warm scorebook paper, clubhouse green, muted scorekeeper red, restrained brass/gold accents, serif display typography, condensed utility labels, and compact scoreboard/stat-table motifs. It should evoke a real baseball scorecard or old club program without becoming novelty retro UI.

Presentation rules:

- mobile web is the primary layout constraint; the public game becomes a full-bleed scorebook sheet on narrow screens rather than a floating desktop card;
- the Daily masthead, edition number, sticky scorebug, active initials, hints, search, actions, resolved result, reveal card, scorecard history, and completion/share surfaces should read as one visual system;
- active initials are the dominant gameplay focal point, while controls remain tactile, high-contrast, and at least comfortable mobile tap targets;
- search suggestions overlay the flow rather than shifting the page, and a selected player suppresses the empty-results dropdown;
- placeholder result-distribution UI is not shown before real persisted aggregate data exists;
- visual polish must not expose hidden answers, move rules into React, change scoring, or alter server-authoritative resolution.

The heritage direction is now the public visual baseline rather than deferred post-mechanics work. Future comparison/percentile UI should extend this same system instead of introducing a second visual language.

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

## Statistics and reveal

Career summary remains separate from chronological regular-season rows. Multi-team seasons retain every team. Known zero and unavailable remain distinct. Rate statistics are not inferred from partial components. WAR, All-Star selections, awards, voting, and leaders require reproducible approved sources; approved Baseball Reference WAR is labeled `bWAR`.

## Architecture constraints

Rules stay outside React/routes; facts stay in baseball-data; scoring stays in engine/shared; recipes stay in Daily; web owns transport, authorization, browser state, and adapters; Supabase is a provider, not a rule owner. No microservices, queues, replay caches, or per-action persistence for launch.

## Launch-ready definition

Lineups are recognizable and editorially reviewable; Hint feels instantaneous; scoring/versioning is coherent; refresh is reliable; search/reveals are accurate; results and sharing are spoiler-safe; comparison works without per-action writes; answer boundaries hold; mobile layouts are polished; deployment/legal/domain/monitoring basics are complete.

## Change rule

Implementation and canonical docs change together. Approved future behavior must be labeled rather than presented as live.
