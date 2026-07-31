# Daily Inning end-to-end blueprint

Status: Living product source of truth  
Last updated: 2026-07-31

## Product decision

Initial Baseball currently has one committed product: **Daily Inning**, a browser-first daily baseball guessing game.

Future themed, decade, team, custom, native, or head-to-head experiences may reuse the same player and rules systems, but they are not committed launch scope.

## Core promise

A player should be able to open the site, understand the game quickly, complete a nine-player game in a few minutes, learn something about each revealed player, compare the result, and share spoiler-safe output.

Baseball knowledge should matter more than luck. The game should feel immediate, accurate, clean, and recognizably baseball.

### Recognizability is a gameplay requirement

Standard Daily should not create difficulty by selecting players the target audience never had a realistic chance to know.

Except for a possible final deep-challenge slot, a revealed player should normally trigger:

> I could have gotten that.

This does not mean every player must be universally obvious. It means the challenge should come from recall, initials, hint timing, and uncertainty—not arbitrary obscurity. Recognizability, expected solve difficulty, and Standard Daily eligibility are first-class product data and must be calibrated through editorial judgment and eventual play results.

Detailed direction: `docs/product/lineup-content-system.md`.

## Current implemented gameplay loop

1. The player opens today's Daily Inning without signing in.
2. Everyone receives the same nine-player puzzle for the date.
3. Each at-bat begins with the hidden player's initials.
4. The player may guess immediately or reveal hints in fixed order.
5. Correct answers map by hint depth:
   - 0 hints: HR and 5 points
   - 1 hint: 3B and 4 points
   - 2 hints: 2B and 3 points
   - 3 hints: 1B and 2 points
   - 4 hints: BB and 1 point
6. An incorrect guess consumes a strike. Three strikes or Give Up produces a K and 0 points.
7. The client records the spoiler-safe raw at-bat facts independently from the point total.
8. A resolved at-bat reveals a canonical career summary and expandable regular-season statistics.
9. `points-v1` continues through all nine scheduled at-bats; three strikeouts do not end the game.
10. Completion produces a score out of 45 and spoiler-safe share output.

The existing runner/base engine remains available as `legacy-inning-v1` compatibility behavior and a possible future alternate policy. It no longer controls completion for new Standard Daily sessions.

## Current scoring and completion policy

Scoring and completion are explicit versioned policies rather than permanent assumptions spread through the UI.

Current Standard Daily uses `points-v1`:

- HR/3B/2B/1B/BB/K score `5/4/3/2/1/0`;
- every player completes all nine at-bats;
- the maximum score is 45;
- stable raw facts preserve slot, outcome, hint count, wrong guesses, and correct/strikeout/Give Up resolution;
- saved pre-ruleset sessions remain on `legacy-inning-v1` so their existing signed progression and three-out behavior are not silently reinterpreted;
- results and percentile comparisons never mix different puzzle identities or ruleset versions.

Exact point weights remain provisional product tuning and may change only through a new ruleset version.

## Interaction quality

Visible game actions should respond immediately.

- All four authorized hints for the active at-bat should be locally available before that at-bat appears.
- Pressing Hint should reveal local data without a normal network wait.
- The prior at-bat’s mandatory resolution response may prepare the next at-bat.
- Answers, canonical answer IDs, future reveal records, and unrelated future-player data remain server-side.
- Search and guess submission may require network access, but loading states must not disrupt the main game rhythm.

This no-visible-wait hint transport remains the next gameplay implementation concern.

## Daily puzzle lifecycle

Each editorial puzzle has a lifecycle:

- `draft`: generated and reviewable;
- `scheduled`: editorially approved for a future date;
- `published`: explicit immutable publication milestone;
- `archived`: retained historical puzzle.

The final puzzle is the exact ordered nine canonical player IDs. An editor may replace future draft/scheduled players through the lifecycle rules. Published and archived puzzles do not change through ordinary editing.

Archive/replay behavior remains a separate future surface; the fact that a date is past does not make its final lineup mutable.

## Lineup content model

Lineup generation is recipe-driven.

A recipe combines:

- slot groups;
- factual filters such as years, teams, positions, Hall of Fame status, approved All-Star counts/years, awards, or sourced WAR thresholds;
- gameplay-profile filters such as recognizability and expected difficulty;
- repeat protection;
- duplicate prevention;
- reveal readiness;
- optional diversity constraints.

“Standard Daily” is one recipe. The authorized editor can generate a proposal, inspect qualification reasons, replace players, validate, and schedule the exact nine.

The current recognizability weighted-stat ranking is not an acceptable final measure. Statistical value and modern fan recognizability are different concepts.

## User-facing surfaces

### Current

- Daily game page;
- points-focused scorebug for new `points-v1` sessions;
- name search and canonical guess submission;
- ordered hints;
- post-at-bat reveal;
- career and season statistics;
- completed-at-bat history;
- spoiler-safe point share output;
- local recovery/reset with legacy-session compatibility;
- authorized seven-day editorial administration.

### Required before broad launch

- clear first-play instructions;
- reliable refresh/already-played behavior;
- immediate hint interaction;
- same-puzzle/same-ruleset field comparison and percentile;
- calibrated recognizable lineups;
- analytics and error monitoring;
- common iPhone/iPad QA;
- privacy policy and terms/disclaimer;
- canonical domain and social metadata.

### Deferred

- required accounts;
- streaks and cross-device history;
- public leaderboards;
- user-created games;
- exposed themed/decade/team libraries;
- native clients;
- head-to-head, chat, leagues, or matchmaking;
- payments.

## State and persistence

Anonymous gameplay remains client-driven at launch. Local persistence restores compatible public game state, ruleset version, raw completed-at-bat facts, point summary, and the opaque signed progression token.

Pre-ruleset signed sessions normalize to `legacy-inning-v1`; new bootstraps use `points-v1`. This avoids silently changing the completion rule inside an already-started anonymous game.

Future aggregate results use at most one compact idempotent completed-game submission. The submission preserves raw per-at-bat facts and ruleset version so score formulas and aggregates can be recalculated without per-action writes.

## Data and answer integrity

- Canonical `playerId`, not display text, identifies the answer.
- Genuine same-name players remain separate.
- Public search shows names only for unique visible names and career years only for genuine duplicates.
- Hidden answers, canonical IDs, reveal records, credentials, and unrelated future-player data must not leak through initial HTML, client bundles, logs, share text, or premature responses.
- Baseball facts are generated from committed/reproducible sources; gameplay does not call a live third-party baseball API.
- Signed stateless progression prevents ordinary forged future progression but does not claim tamper-proof anonymous scoring.
- Accounts, prizes, authoritative streaks, or public competitive leaderboards require a separate stronger-integrity decision.

## Statistics and reveal contract

Career and season statistics are reveal content, not answer-validation logic.

- Career summary remains separate from chronological regular-season rows.
- Multi-team seasons retain every team.
- Hitter, pitcher, and two-way presets remain configurable.
- Known zero remains zero; unavailable remains `null`.
- Rate statistics are not estimated from partial source components.
- WAR, All-Star selections, awards, voting finishes, and leader flags require approved reproducible sources before display or recipe use.
- Baseball Reference WAR, if approved, is labeled `bWAR`.

## Results

Current local results include:

- point total and maximum;
- all nine spoiler-safe initials/outcomes;
- strikeout count;
- ruleset version in the result contract.

Intended aggregate results additionally include:

- understandable percentile language;
- comparison sample size;
- average score;
- outcome distribution by at-bat;
- solve rate by hint depth;
- K and Give Up rates;
- raw facts sufficient for recalculation.

Percentiles compare only the same puzzle and ruleset version.

## Architecture constraints

- Portable rules and Daily logic stay outside React and routes.
- Baseball facts and enrichment stay in `packages/baseball-data`.
- Scoring/completion stays in the engine/shared contracts.
- Recipe generation and validation stay in `packages/daily`.
- Web code renders, transports, authorizes, and adapts persistence.
- Supabase is a provider, not the owner of facts or product policy.
- No microservices, queues, replay caches, or per-action database sessions for launch.

## Definition of launch-ready

Daily Inning is ready for broad friend distribution when:

- lineups are recognizable, challenging, and editorially reviewable;
- Hint actions feel immediate;
- the chosen scoring/completion policy is coherent and versioned;
- refreshes and ordinary errors do not erase progress;
- search and reveal data are accurate;
- results and sharing are reliable and spoiler-safe;
- field comparison works without per-action database writes;
- answer-integrity boundaries hold;
- common mobile layouts are polished;
- analytics, monitoring, deployment, legal, domain, and social basics are in place.

## Change rule

When product behavior changes, implementation and the relevant canonical documents change together. Approved but not yet implemented decisions must be labeled as such rather than presented as live behavior.
