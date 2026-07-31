# Initial Baseball — Start Here

Status: Active project handoff  
Last updated: 2026-07-31

Use this file to resume work. It records verified current state, settled future requirements, genuinely open decisions, and the exact next bounded work. Pull requests and `tasks/lessons.md` retain history.

## Resume protocol

1. Read `AGENTS.md`.
2. Read this file.
3. Read `tasks/todo.md`.
4. Verify current GitHub `main`, open PRs/issues, CI, Vercel, Supabase configuration, and production behavior.
5. Read only the canonical documents/source needed for the next bounded task.
6. Write the scope contract before implementation.
7. Complete one owning concern per PR.

Do not restart settled discussions because the conversation changed. Correct drift before new implementation.

## Product promise

Initial Baseball currently means **Daily Inning**, a browser-first daily game with the same nine-player puzzle for everyone on a Pacific date.

Standard Daily should be difficult because recall and hints are difficult, not because players are arbitrarily obscure. Except for a possible final deep-challenge slot, a reveal should normally prompt: **“I could have gotten that.”**

The game should feel immediate, accurate, and recognizably baseball.

## Architecture map

```text
shared
  ├── engine
  └── baseball-data
         \
          daily
            \
             web / API / admin adapters
                       \
                        Supabase/Postgres adapters
```

- shared: portable contracts/version identifiers;
- engine: outcomes, scoring/completion, runner rules, search, results;
- baseball-data: canonical facts/enrichment/provenance/runtime artifacts;
- daily: future profiles/recipes, selection, repeats, validation, lifecycle, repository/service ports;
- web: rendering, browser state, signed authorization, active hint bundles, routes/admin/adapters;
- Supabase: operational persistence, not facts or product rules.

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Lineup content: `docs/product/lineup-content-system.md`.  
Architecture: `docs/architecture-and-scale-plan.md`.  
Answer integrity: `docs/decisions/0001-daily-answer-integrity.md`.

## Current verified state

- PRs #120–#122 are merged; editorial public consumption, hosted Basic auth, and repository continuity controls are established.
- PR #124 merged at `555890cb8d53cb7e06d842d9cefc7787a1c1ce40`; new games use `points-v1` and all scheduled at-bats.
- PR #125 reconciled the verified points production deployment into canonical docs.
- Production deployment `dpl_GcC8FtpbPnk2mUAzNVuNvo683wmN` is `READY` at `https://initial-baseball-web.vercel.app`.
- Production public HTML was verified to show `0/45 PTS`, `0/9 AB`, and a signed `points-v1` token without answer IDs/names, reveal records, credentials, or service-role data.
- Points work passed full tests, typecheck, file-size checks, complete canonical data/runtime QA, production build, and hidden-answer build QA.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview/Production.
- `daily_editorial_puzzles` migration and RLS/service-role checks passed.
- Unauthenticated `/admin/daily` reaches the challenge and the editor previously authenticated.
- Recent production runtime-error checks reported none.
- A scheduled automation will verify the July 31 midnight-Pacific rollover without a redeploy.

## Implemented gameplay

New Standard Daily sessions use `points-v1`:

- HR/3B/2B/1B/BB/K = `5/4/3/2/1/0`;
- all nine scheduled at-bats are played;
- raw facts preserve slot, initials, outcome, hints, wrong guesses, and correct/K/Give Up resolution;
- ruleset version flows through token, local state, final result, and share output;
- compatible old sessions remain `legacy-inning-v1` with three-out behavior.

### Immediate active-batter hints

The active web client no longer waits on a network request when Hint is pressed.

- Bootstrap authorizes and sends all four hints for batter one plus signed later-depth checkpoints.
- Each Hint click reveals local data and adopts the matching signed checkpoint.
- Incorrect guesses return a refreshed same-pitch bundle with updated strike claims.
- Correct/K/Give Up returns only the next pitch’s bundle unless complete.
- Saved progress hydrates only its verified current bundle through `POST /api/daily/hints` before becoming interactive.
- The legacy `POST /api/daily/hint` route remains server-compatible but is absent from active client chunks.
- Answers, canonical IDs, reveal records, credentials, and unrelated future-batter hints remain server-side.

A technical user may inspect all current-batter hints and replay a prior token. This remains within the accepted anonymous noncompetitive model; stronger competition requires server-authoritative attempts.

## Settled future content system

### Canonical player facts versus gameplay profiles

One authoritative canonical player system is enriched through reproducible sources. Objective facts stay in baseball-data. Editable gameplay profiles separately describe recognizability, difficulty, Standard Daily eligibility, expert-only status, manual promotion/exclusion, notes, and later observed solve rates.

### Recipe-driven lineups

Standard Daily is one versioned recipe, not the only hardcoded selector. Recipes may define slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and diversity constraints. The generator proposes; the editor reviews/replaces/validates/schedules the exact nine.

### Completed results

Future aggregation uses one compact idempotent completed-game write from native raw facts and ruleset version. Percentiles compare the same puzzle and ruleset. No per-action database writes.

## Remaining hosted verification

These require production/browser and/or authenticated editor work and must not be inferred from CI:

- verify the instant-hint production deployment, initial active bundle, no future-batter leak, and no active per-click route;
- verify saved-session bundle hydration and all-nine refresh recovery in a real browser;
- verify the seven-day Supabase horizon, missing drafts, player preview/search/replacement, validation, scheduling, public consumption, and deterministic fallback;
- verify correct guess, wrong guesses, third strike, Give Up, completion, action responses/logs, and common iPhone/iPad behavior.

## Exact next work order

1. Merge and verify the instant active-hint implementation in production.
2. Complete the authenticated admin and full real-browser checklist when the editor is available.
3. Define/persist compact completed-game results and same-puzzle/same-ruleset percentiles.
4. Define gameplay-profile and lineup-recipe contracts, then establish a conservative recognizable Standard Daily recipe/pool.
5. Continue analytics, monitoring, mobile polish, legal/domain basics, and heritage presentation.

## Open decisions

- Final point weights and wrong-guess penalty; changes require a new ruleset version.
- Exact Standard Daily recipe thresholds after playtesting.
- Approved All-Star/award/bWAR source workflows.
- Persistence/admin UX for profiles/recipes.
- Automatic publication, emergency correction, archive/replay, and eventual themed/custom public modes.

## Continuity control

Repository docs are the system of record. Every PR has Documentation impact; CI checks material diffs; hosted work is incomplete until START-HERE/todo are reconciled. The documentation-impact check is not yet mandatory branch protection; issue #123 remains open after the owner declined an uncertain ruleset configuration.
