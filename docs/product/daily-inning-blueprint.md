# Daily Inning end-to-end blueprint

Status: Living source of truth
Last updated: 2026-07-20

## 1. Product decision

Initial Baseball is currently one product: Daily Inning, a browser-first daily baseball guessing game.

A future head-to-head mode or native client is possible, not committed scope. Current work may preserve inexpensive reuse seams but must not add requirements or infrastructure solely for hypothetical products.

## 2. Core promise

A player should be able to open the site, understand the game quickly, complete one baseball inning in a few minutes, learn something about the revealed players, and share a spoiler-safe result.

Baseball knowledge should matter more than luck. The game should feel clean, fast, accurate, and recognizably baseball.

## 3. Canonical gameplay loop

1. The player opens today's Daily Inning without signing in.
2. Everyone receives the same nine-player puzzle for the Daily date.
3. Each at-bat begins with the hidden player's initials.
4. The player may guess immediately or reveal hints in the fixed order.
5. A correct answer produces an outcome based on revealed hints:
   - 0 hints: HR
   - 1 hint: 3B
   - 2 hints: 2B
   - 3 hints: 1B
   - 4 hints: BB
6. An incorrect guess consumes a strike. Three strikes or Give Up produces a K.
7. The engine advances runners, outs, hits, walks, and runs.
8. The resolved player is revealed with a career summary and expandable regular-season statistics.
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
- Local reset for testing and alpha recovery

### Required before broad launch

- Clear first-play instructions
- Reliable already-played and refresh recovery
- Final results summary
- Aggregate field comparison by at-bat and outcome
- Editorial workflow for tomorrow's lineup
- Analytics and error monitoring
- Privacy policy and basic terms/disclaimer
- Canonical production domain and social metadata

### Deferred

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

The system generates a deterministic default lineup from recognizability tiers. An editor may replace players before publication. Published puzzles must not silently change.

Manual code overrides are an interim adapter. The target is an admin workflow behind a `DailyPuzzleRepository` boundary.

## 6. Recognizability and lineup quality

The default nine-player curve is:

- At-bats 1-2: top 250
- At-bats 3-4: top 1,000
- At-bats 5-6: top 2,500
- At-bats 7-9: top 5,000

Requirements:

- No duplicate canonical players in one puzzle.
- Avoid players used within the approved repeat window, currently 90 days.
- Ordering is deterministic for a date and data version.
- Historical overrides remain reproducible.
- Editorial review can replace any candidate before publication.
- Player metadata and statistics are traceable to committed sources.

## 7. State and persistence

Anonymous gameplay remains client-driven at launch.

Local persistence restores:

- puzzle identity and schema version;
- current at-bat index;
- inning state;
- revealed hints and strike count;
- resolved at-bat results;
- pending reveal/advance state;
- completed-game share result;
- the opaque signed progression token used for later server-authorized actions.

The token is an authorization adapter, not the owner of the visible game state or baseball score. It contains only public progression fields and no answer, hint value, reveal record, base state, or run total.

Invalid, stale, mismatched, or unverifiable saved state fails safely. Saved legacy player IDs resolve through canonical redirects when submitted. A saved state without a compatible token must not invent later authorized progression; migration may restart an unresolved current at-bat when necessary while preserving completed history when possible.

When aggregate statistics are introduced, the client submits at most one compact, idempotent completed-game result rather than writing every interaction.

## 8. Data and answer integrity

The accepted launch threat model is recorded in `docs/decisions/0001-daily-answer-integrity.md`.

- A player answer is identified by canonical `playerId`, not display text.
- Search aliases do not determine the reveal display name.
- Genuine same-name players remain separate and receive context such as career years, position, or teams.
- Search remains accent-insensitive and supports ordered token matching.
- Hidden answers must not leak through initial HTML, serialized props, client bundles, logs, share text, public static data, or prematurely loaded reveal records.
- Baseball data is generated ahead of time from committed sources; gameplay does not use a live third-party baseball API.
- The runtime serving layer joins canonical records but does not calculate baseball facts.
- Hint and resolution routes derive puzzle date, current pitch, hint depth, strikes, and outs from a verified stateless signed token rather than trusting browser counters.
- A caller cannot forge later progression, use a token across puzzles/dates, or directly request an arbitrary future pitch.
- Correct, third-strike, and Give Up responses reveal only the token-authorized current player.

Launch answer integrity is not adversarial anti-cheat. A determined player may replay an earlier valid request, reset or manipulate local state, or deliberately Give Up through the lineup. Daily does not claim tamper-proof scoring, one-time action consumption, or authoritative anonymous attempt history.

Accounts, prizes, public competitive leaderboards, or authoritative streaks require a separate stronger-integrity decision rather than silently expanding this launch model.

## 9. Statistics and reveal contract

Career and season statistics are reveal content, not answer-validation logic.

Supported hitter fields include AB, H, HR, BA, R, RBI, SB, OBP, SLG, and OPS.

Supported pitcher fields include W, L, SV, ERA, WHIP, K, and IP.

Reveal structure:

- a separate career summary;
- one chronologically ordered row per regular season;
- all teams represented for multi-team seasons;
- hitter, pitcher, and two-way display presets;
- configurable presentation columns without moving data ownership into the UI.

A known zero is shown as zero. An unavailable value remains `null` and is omitted or displayed as unavailable. OBP, SLG, and OPS are not estimated from partially known source rows.

WAR must not be displayed until a reproducible source is committed. If Baseball Reference WAR is approved later, it is labeled `bWAR`. OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags follow the same upstream-source requirement.

Canonical runtime records supply live answer resolution and reveal data. The browser receives the lightweight public puzzle first and receives a full canonical reveal only after the at-bat is resolved.

## 10. Administration

The first admin workflow allows an authorized editor to:

- inspect generated future puzzles;
- search and replace a lineup slot;
- distinguish same-name players using canonical context;
- validate duplicates, recognizability tier, recent repeats, and required reveal data;
- preview initials, hints, and reveal content;
- schedule or publish a puzzle;
- see whether a published puzzle differs from its generated draft.

Admin code uses repository/service boundaries rather than editing generated JSON or database records directly from React components.

## 11. Aggregate results

The launch-scale model stores one compact record per completed game, sufficient to calculate:

- completion count;
- average runs and hits;
- outcome distribution by at-bat;
- solve rate by hint depth;
- strikeout and give-up rate;
- final-run distribution.

Raw completed-game outcomes are retained so aggregates can be recalculated after logic or display changes.

## 12. Architecture constraints

- Browser-first Next.js client.
- Pure portable TypeScript rules and Daily logic outside React and Next.js routes.
- Generated baseball data owned by `packages/baseball-data`.
- Daily puzzle creation and session transitions owned by `packages/daily`.
- Next.js routes and components remain thin adapters and renderers.
- Stateless progression signing and verification remain a provider-neutral `apps/web` adapter with a server-only secret.
- One small relational database is sufficient when publication, aggregate results, or accounts require persistence.
- No microservices, queues, replay caches, real-time subscriptions, or server-side per-play sessions for launch.

## 13. Quality gates

A material change is complete only when:

- focused tests cover behavior at the owning layer;
- full tests, typecheck, build, and file-size checks pass;
- generated data reports and representative records are inspected when data contracts change;
- review findings are resolved;
- mobile web behavior is checked for user-facing changes;
- answer leakage and spoiler-safe sharing remain protected;
- progression tests cover tampering, cross-date use, future-pitch attempts, hints, strikes, outs, completion, and terminal reveal boundaries;
- canonical documentation and `tasks/todo.md` reflect the resulting state.

## 14. Definition of launch-ready

Daily Inning is ready for broad friend distribution when:

- the nine-player puzzle is reliable and editorially reviewable;
- the game is polished at common iPhone and iPad web sizes;
- refreshes and ordinary errors do not erase progress;
- search handles aliases, accents, and same-name cases;
- reveal data is accurate and understandable;
- final results and sharing are reliable and spoiler-safe;
- ordinary callers cannot request arbitrary future players or fabricate server-authorized progression;
- aggregate results work without per-action database writes;
- analytics, error monitoring, deployment, domain, and legal basics are in place.

## 15. Change rule

This document describes the product as it currently exists and is intended to work. When a product decision changes, implementation and this blueprint must change together.
