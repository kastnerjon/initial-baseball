# Initial Baseball Build Plan

## Phase 0 — Repo scaffold and setup

- [ ] Push this v0.3 scaffold to `kastnerjon/initial-baseball`.
- [ ] Connect coding agent to repo.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm test` and `pnpm typecheck`.
- [ ] Create Supabase projects: dev, staging, prod.
- [ ] Store environment variables locally and in deployment secrets.

## Phase 1 — Shared types and pure engine

- [ ] Finalize Daily Inning types.
- [ ] Finalize player/stat types and bWAR labels.
- [ ] Implement/verify initials generation.
- [ ] Implement/verify guess matching.
- [ ] Implement/verify hit result by reveal count.
- [ ] Implement/verify runner advancement and inning scoring.
- [ ] Implement/verify Daily share formatter.
- [ ] Implement/verify Daily aggregate stat helper.

## Phase 2 — Player database seed v0

- [ ] Build curated seed format for 200–500 recognizable players.
- [ ] Include hitters and pitchers.
- [ ] Include canonical IDs, aliases, primary role, position, main decade, teams, stats.
- [ ] Include bWAR only if Baseball Reference source is used and label it bWAR.
- [ ] Add quality checks for missing Daily hint fields.

## Phase 3 — Daily Inning database/API

- [ ] Apply daily tables to Supabase dev.
- [ ] Implement anonymous player creation/lookup.
- [ ] Implement get today's puzzle endpoint/query.
- [ ] Implement submit Daily pitch result.
- [ ] Implement complete Daily attempt.
- [ ] Implement aggregate stats query.
- [ ] Keep player names hidden until completion.

## Phase 4 — Daily Inning web private beta

- [ ] Build mobile-friendly Daily page.
- [ ] Build initials/hints/guess flow.
- [ ] Build inning scoreboard.
- [ ] Build results page.
- [ ] Build spoiler-safe share text.
- [ ] Show field comparison by initials after completion.
- [ ] Test with friends through a private/staging URL.

## Phase 5 — Daily Inning public web launch

- [ ] Buy/connect domain.
- [ ] Add analytics.
- [ ] Add error logging.
- [ ] Add privacy policy and terms/disclaimer.
- [ ] Add Open Graph/social metadata.
- [ ] Add daily puzzle admin/publishing workflow.
- [ ] Decide whether to add ads/sponsorship only after traffic exists.

## Phase 6 — Optional account/streak layer

- [ ] Add optional Supabase Auth.
- [ ] Claim anonymous attempts into account.
- [ ] Add streak/history.
- [ ] Add app waitlist/CTA.

## Phase 7 — H2H mobile app, later

- [ ] Expo app shell.
- [ ] Auth and username.
- [ ] Friend games.
- [ ] Random opponents.
- [ ] Game-only chat with report/block.
- [ ] League Lite.
- [ ] Push/deep links.
- [ ] TestFlight/Play testing only after web signal.
