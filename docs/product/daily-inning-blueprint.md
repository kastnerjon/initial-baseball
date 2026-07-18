# Daily Inning end-to-end blueprint

Status: Living source of truth
Last updated: 2026-07-18

## 1. Product decision

Initial Baseball is currently one product: Daily Inning, a browser-first daily baseball guessing game.

A future head-to-head mode is a possibility, not a committed roadmap item. Current work may preserve inexpensive reuse seams, but must not add infrastructure, product requirements, or abstractions solely for a hypothetical second game.

## 2. Core promise

A player should be able to open the site, understand the game quickly, complete one baseball inning in a few minutes, learn something about the revealed players, and share a spoiler-safe result.

Baseball knowledge should matter more than luck. The game should feel clean, fast, accurate, and recognizably baseball.

## 3. Canonical gameplay loop

1. The player opens today's Daily Inning without signing in.
2. The same nine-player puzzle is presented to every player for the Daily date.
3. Each at-bat begins with the hidden player's initials.
4. The player may guess immediately or reveal hints in the fixed order.
5. A correct answer produces an outcome based on how many hints were revealed:
   - 0 hints: HR
   - 1 hint: 3B
   - 2 hints: 2B
   - 3 hints: 1B
   - 4 hints: BB
6. An incorrect guess consumes a strike. Three strikes or Give Up produces a K.
7. The baseball engine advances runners, outs, hits, walks, and runs.
8. The resolved player is revealed with career and optional season-by-season statistics.
9. The inning ends after three outs or after all nine scheduled at-bats are resolved, according to the implemented Daily rules.
10. The player receives a spoiler-safe share result.

## 4. User-facing surfaces

### Current launch surface

- Daily game page
- Compact baseball scorebug
- Player search and guess flow
- Hint reveal controls
- Post-at-bat player reveal
- Expandable season-by-season statistics
- Completed-at-bat history
- Final score and share output
- Local reset for testing/alpha recovery

### Required before broad launch

- Clear first-play instructions
- Reliable already-played and refresh recovery behavior
- Final results summary
- Aggregate field comparison by at-bat/outcome
- Editorial workflow for tomorrow's lineup
- Analytics and error monitoring
- Privacy policy and basic terms/disclaimer
- Canonical production domain and social metadata

### Deferred until the core loop proves demand

- Required accounts
- Streaks and cross-device history
- Public leaderboards
- Native iOS or Android clients
- Head-to-head play
- Chat, leagues, matchmaking, or social graphs
- Payments

## 5. Daily puzzle lifecycle

Each puzzle has a lifecycle:

- `draft`: generated automatically and available for editorial review
- `scheduled`: approved for a future Daily date
- `published`: immutable public puzzle for its Daily date
- `archived`: historical published puzzle retained for audit and replay support

The system should generate a deterministic default lineup from recognizability tiers. An editor may replace players before publication. Published puzzles must not silently change.

For the current code-based phase, manual overrides are an interim adapter. The target state is an admin workflow backed by a `DailyPuzzleRepository` boundary.

## 6. Recognizability and lineup quality

The default nine-player curve is:

- At-bats 1-2: candidates from the top 250
- At-bats 3-4: candidates from the top 1,000
- At-bats 5-6: candidates from the top 2,500
- At-bats 7-9: candidates from the top 5,000

Requirements:

- No duplicate canonical players within one puzzle.
- Ordering is deterministic for a given date and data version.
- Historical overrides remain reproducible.
- Editorial review can replace any candidate before publication.
- Player metadata and stats must be traceable to committed source data.

## 7. State and persistence

Anonymous gameplay remains client-driven at launch.

Local persistence must restore:

- puzzle identity and schema version
- current at-bat index
- inning state
- revealed hints and strike count
- resolved at-bat results
- pending reveal/advance state
- completed-game share result

Invalid, stale, or mismatched saved state should fail safely without breaking the game.

When aggregate statistics are introduced, the client should submit at most one compact, idempotent completed-game result rather than writing every interaction to the database.

## 8. Data and answer integrity

- A player answer is identified by canonical `playerId`, not display text.
- Aliases and same-name records may map one visible search option to multiple accepted canonical IDs when required.
- Search remains accent-insensitive and supports ordered token matching.
- Hidden answers must not leak through initial page data, API responses, HTML, share text, or client logs.
- Baseball data is generated ahead of time from committed sources; gameplay must not depend on a live third-party baseball API.

## 9. Statistics

Career and season statistics are reveal content, not answer validation logic.

Current supported reveal fields:

Hitters: AB, H, HR, BA, R, RBI, SB, OBP, SLG, OPS.

Pitchers: W, L, SV, ERA, WHIP, K, IP.

WAR must not be displayed until a reproducible source is committed. If Baseball Reference WAR is later used, it must be labeled `bWAR`.

## 10. Administration

The first admin workflow should allow an authorized editor to:

- inspect automatically generated future puzzles
- search and replace a player in a lineup slot
- validate duplicates and required hint/stat data
- preview initials, hints, and reveal content
- schedule or publish a puzzle
- see whether a published puzzle differs from its generated draft

Admin code must use repository/service boundaries rather than editing database records from React components.

## 11. Aggregate results

The launch-scale result model should store one compact record per completed game, sufficient to calculate:

- completion count
- average runs and hits
- outcome distribution for each at-bat
- solve rate by hint depth
- strikeout/give-up rate
- distribution of final run totals

Raw completed-game outcome data should be retained so aggregates can be recalculated after logic or display changes.

## 12. Architecture constraints

- Browser-first Next.js client.
- Pure portable TypeScript rules and Daily logic outside React and Next.js routes.
- Generated baseball data owned by `packages/baseball-data`.
- Daily puzzle creation and session transitions owned by `packages/daily`.
- Next.js routes and components remain thin adapters and renderers.
- One small relational database is sufficient when publication, aggregate results, or accounts require persistence.
- No microservices, queues, real-time subscriptions, or server-side per-play sessions for launch.

## 13. Quality gates

A change is complete only when:

- behavior is covered by focused tests
- full tests, typecheck, build, and file-size checks pass
- mobile web behavior is checked for user-facing changes
- answer leakage and spoiler-safe sharing remain protected
- relevant canonical documentation is updated in the same pull request

## 14. Definition of launch-ready

Daily Inning is ready for broad friend distribution when:

- the nine-player puzzle is reliable and editorially reviewable
- the full game is polished on common iPhone viewport sizes
- refreshes and ordinary errors do not erase progress
- search handles common aliases, accents, and same-name cases
- reveal data is accurate and understandable
- final results and sharing are reliable and spoiler-safe
- aggregate results work without per-action database writes
- analytics, error monitoring, deployment, and legal basics are in place

## 15. Change rule

This document describes the product as it exists and is currently intended to work. It is not immutable. When a product decision changes, the implementation and this blueprint must be updated together.