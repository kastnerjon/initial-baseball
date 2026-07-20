# Initial Baseball Current Work

Status: Active ordered implementation plan
Last updated: 2026-07-20

Completed work should not remain here as future work. Historical rationale belongs in pull requests, canonical documentation, or `tasks/lessons.md`.

Current execution order: finish the bounded launch answer-integrity decision, then return directly to visible Daily product work. Canonical identity inputs are now pinned and reproducible; no additional foundation work should be inserted unless a concrete roadmap item requires it.

## 0. Complete launch answer-integrity stabilization

- [ ] Approve the anonymous, client-driven launch threat model in issue #91 without claiming tamper-proof scoring.
- [ ] Implement stateless signed progression authorization in a separate bounded PR.
- [ ] Prevent arbitrary future-pitch requests while keeping scoring and Daily transitions in their existing portable owners.
- [ ] Preserve refresh recovery without adding a replay cache, database write per action, durable anonymous server session, or hosting-specific dependency.
- [ ] Re-run hidden-answer build QA and close recovery issue #86.

## 1. Complete the reveal experience

- [ ] Show the canonical career summary after each resolved at-bat.
- [ ] Show one ordered row per regular season, including multiple teams when applicable.
- [ ] Support configurable reveal columns without changing canonical data ownership.
- [ ] Display OPS for hitters and saves for pitchers when available.
- [ ] Keep WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags hidden until approved upstream data exists.
- [ ] Add representative UI QA for David Ortiz, Mariano Rivera, Shohei Ohtani, Ken Griffey Jr., David Wright, Willie Mays, and the distinct Ben Taylor identities.

## 2. Finalize Daily lineup quality

- [ ] Apply the nine-slot recognizability curve: top 250 for at-bats 1-2, top 1,000 for 3-4, top 2,500 for 5-6, and top 5,000 for 7-9.
- [ ] Avoid recently used players within the approved repeat window, currently 90 days.
- [ ] Confirm deterministic generation for a date and reviewed data version.
- [ ] Verify historical overrides and saved references still resolve after runtime migration.

## 3. Add tomorrow-lineup administration

- [ ] Generate tomorrow's draft lineup automatically.
- [ ] Show canonical ID, display name, career years, role/position, teams, and data-quality warnings.
- [ ] Allow an authorized editor to replace any slot through a repository/service boundary.
- [ ] Validate duplicates, recognizability tier, recent repeats, and required reveal data.
- [ ] Support draft, scheduled, published, and archived states.
- [ ] Keep published puzzles immutable except through an explicit editorial/versioning action.

## 4. Complete launch surfaces

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
