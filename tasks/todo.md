# Initial Baseball Current Work

Status: Active ordered implementation list
Last updated: 2026-07-20

Completed work should not remain here as future work. Historical rationale belongs in pull requests, canonical documentation, or `tasks/lessons.md`.

## 1. Finish the canonical runtime payload

- [x] Build canonical identities and Lahman-first universe.
- [x] Build season facts, player-season aggregates, and season cards.
- [x] Build career aggregates and career cards.
- [x] Build season and career enrichment.
- [x] Require complete contributing source rows before publishing OBP, SLG, or OPS.
- [x] Generate a lightweight player index, reveal shards, and valid legacy redirects.
- [ ] Complete review of PR82 and merge only after CI, generated reports, representative records, and review threads are clean.

## 2. Migrate the web runtime to canonical player data

- [ ] Add a baseball-data accessor for the lightweight canonical player index.
- [ ] Resolve legacy saved and override IDs through canonical redirects.
- [ ] Migrate search and answer matching without using display names as identity keys.
- [ ] Distinguish genuine same-name players with position, career years, and team context where needed.
- [ ] Fetch full reveal data by canonical ID and shard only after it is safe to expose.
- [ ] Add explicit hidden-answer leakage tests for initial HTML, serialized props, routes, and browser logs.
- [ ] Remove the corresponding legacy runtime path only after compatibility tests pass.

## 3. Complete the reveal experience

- [ ] Show the canonical career summary after each resolved at-bat.
- [ ] Show one ordered row per regular season, including multiple teams when applicable.
- [ ] Use hitter, pitcher, and two-way column presets.
- [ ] Support configurable reveal columns without changing canonical data ownership.
- [ ] Display OPS for hitters and saves for pitchers when available.
- [ ] Keep WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags hidden until approved upstream data exists.
- [ ] Add representative UI QA for David Ortiz, Mariano Rivera, Shohei Ohtani, Ken Griffey Jr., David Wright, Willie Mays, and the distinct Ben Taylor identities.

## 4. Finalize Daily lineup quality

- [ ] Apply the nine-slot recognizability curve: top 250 for at-bats 1-2, top 1,000 for 3-4, top 2,500 for 5-6, and top 5,000 for 7-9.
- [ ] Prevent duplicate canonical players within one lineup.
- [ ] Avoid recently used players within the approved repeat window, currently 90 days.
- [ ] Confirm deterministic generation for a date and data version.
- [ ] Verify historical overrides and saved references still resolve after runtime migration.

## 5. Add tomorrow-lineup administration

- [ ] Generate tomorrow's draft lineup automatically.
- [ ] Show canonical ID, display name, career years, role/position, teams, and data-quality warnings.
- [ ] Allow an authorized editor to replace any slot through a repository/service boundary.
- [ ] Validate duplicates, recognizability tier, recent repeats, and required reveal data.
- [ ] Support draft, scheduled, published, and archived states.
- [ ] Keep published puzzles immutable except through an explicit editorial/versioning action.

## 6. Complete launch surfaces

- [ ] Add the field-comparison results screen from one compact completed-game submission.
- [ ] Add analytics and error monitoring.
- [ ] Verify refresh recovery and already-played behavior.
- [ ] Measure initial payload size and interaction latency.
- [ ] Verify common iPhone and iPad web layouts.
- [ ] Add privacy policy, terms/disclaimer, canonical domain, and social metadata.

## Deferred

- Accounts, streaks, and cross-device history.
- Native iOS or Android clients.
- Head-to-head play, chat, leagues, and matchmaking.
- Payments or other monetization work before the Daily loop proves demand.
