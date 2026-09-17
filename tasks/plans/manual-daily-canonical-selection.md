# Manual Daily canonical selection

Status: implementation scope contract

## Goal

Allow authorized manual Daily lineup curation to select any canonical, reveal-ready MLB player represented by the existing Daily-compatible player data, while leaving automatic Daily generation restricted to the current `dailyEligiblePlayers` pool and recognizability ranks.

## Owning layer

Primary domain ownership is `packages/daily`: it owns candidate eligibility/rank semantics and lineup validation. `apps/web` composes the broader editorial candidate universe into the existing admin/ChatOps adapter. Baseball facts remain owned by `packages/baseball-data`; persistence/lifecycle authority is unchanged.

## In scope

- Preserve the existing ranked automatic candidate pool derived from `dailyEligiblePlayers`.
- Build an editorial candidate pool by adding canonical, reveal-ready players from the broader `baseballPlayers` universe.
- Give editorial-only players no automatic recognizability rank so `generateDailyLineup` cannot select them.
- Allow admin search, preview, single-slot replacement, and exact-nine ChatOps replacement to resolve those editorial-only candidates.
- Return an explicit `outside-automatic-daily-pool` validation warning for manually selected editorial-only players.
- Preserve exact-nine, canonical uniqueness, repeat, reveal-readiness, future-date, optimistic-revision, audit, and published/archive immutability behavior.
- Update canonical lineup architecture, handoff/todo, and the ChatOps runbook.

## Out of scope

- Changing `core`/`extended`/`none` thresholds or `dailyEligiblePlayers` generation.
- Changing automatic lineup recipes, rank bands, deterministic seeds, or the 90-day repeat policy.
- Adding player-data overrides or changing canonical facts.
- Bypassing the admin workflow or writing editorial rows directly in Supabase.
- Changing publication semantics or published-puzzle correction/versioning.
- Redesigning `/admin/daily`.

## Acceptance checks

- Focused Daily tests prove automatic generation ignores editorial-only unranked candidates and validation emits the explicit manual warning.
- Web admin workflow tests prove unranked reveal-ready canonical players can be searched/replaced without weakening unknown-player/reveal safety.
- Full typecheck, tests, file-size checks, canonical data QA, and production build pass.
- Bounded review confirms no automatic-generation behavior changed.
- After production deployment, ChatOps successfully schedules the owner-provided #147 and #148 lineups, including modern Eduardo Rodríguez and 2012–2021 OF Adam Eaton, with exact persisted readback.

## Stop conditions

Stop and split follow-up work if the broader manual universe requires changing canonical fact/reveal contracts, adding persistence, changing automatic generation output, weakening published immutability, or introducing a new client/server authority model.