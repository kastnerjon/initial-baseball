# Initial Baseball — Start Here

Status: Active project handoff  
Last updated: 2026-07-31

Use this file to resume work. It records verified current state, settled future requirements, genuinely open decisions, and the exact next bounded work. Pull requests and `tasks/lessons.md` retain history.

## Resume protocol

1. Read `AGENTS.md`.
2. Read this file.
3. Read `tasks/todo.md`.
4. Verify current GitHub `main`, open pull requests, relevant issues, CI, Vercel, Supabase configuration, and production behavior.
5. Read only the canonical documents and source files needed for the next bounded task.
6. Write the repository scope contract before implementation.
7. Complete one owning concern per pull request.

Do not restart settled product or architecture discussions because the conversation changed. If this handoff conflicts with code, deployment state, or another canonical document, correct the drift before new implementation.

## Product promise

Initial Baseball currently means one committed product: **Daily Inning**, a browser-first daily baseball guessing game with the same nine-player puzzle for everyone on a date.

Standard Daily must be challenging because recall and hints are challenging, not because the lineup is full of obscure players. Except for a possible final deep-challenge slot, a revealed answer should normally produce the reaction: **“I could have gotten that.”** A player who was never realistically recognizable to the target baseball audience is generally not appropriate for Standard Daily.

The game should feel fast, immediate, accurate, and recognizably baseball. Pressing a visible gameplay control—especially **Hint**—should not wait for ordinary network latency.

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

- `packages/shared`: stable portable contracts and version identifiers.
- `packages/engine`: pure outcomes, scoring/completion policies, baseball advancement, search, and result calculations.
- `packages/baseball-data`: canonical identity, aliases, factual baseball data, enrichment, provenance, QA, and runtime artifacts.
- `packages/daily`: puzzle numbering, future gameplay profiles and lineup recipes, selection, repeat protection, lifecycle, repository/service contracts, and portable Daily orchestration.
- `apps/web`: rendering, browser persistence, routes, sharing, signed-token transport, admin surfaces, server-only composition, and persistence adapters.
- Supabase/Postgres: operational persistence behind provider-neutral ports. It does not define baseball facts, scoring, lineup recipes, or lifecycle policy.

Canonical product behavior: `docs/product/daily-inning-blueprint.md`.  
Canonical lineup-content direction: `docs/product/lineup-content-system.md`.  
Canonical architecture: `docs/architecture-and-scale-plan.md`.  
Documentation rules: `docs/engineering/documentation-governance.md`.

## Current verified state

- PR #120 merged: the public runtime reads approved editorial puzzles through the server repository boundary.
- PR #121 merged: the Daily admin HTTP Basic challenge moved to `/admin/auth`, fixing the hosted redirect loop.
- PR #122 merged: repository continuity controls and the approved scoring, hint, recognizability, and recipe-driven lineup direction are canonical.
- PR #124 merged at main SHA `555890cb8d53cb7e06d842d9cefc7787a1c1ce40`: new Standard Daily sessions use versioned `points-v1` scoring and all scheduled at-bats.
- Production deployment `dpl_GcC8FtpbPnk2mUAzNVuNvo683wmN` is `READY` and aliased to `https://initial-baseball-web.vercel.app`.
- Production public HTML was verified to show `0/45 PTS`, `0/9 AB`, and a signed `points-v1` progression token.
- The points deployment passed full tests, typecheck, file-size checks, the complete canonical data/runtime pipeline, production build, and hidden-answer build QA for two initial payloads and twenty client chunks.
- The verified initial production payload contained no answer names, canonical answer IDs, hint values, reveal records, credentials, or service-role data.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview and Production.
- The `daily_editorial_puzzles` migration is applied. Hosted table/RLS verification passed; browser roles have no CRUD access and the service role has the intended server-only boundary.
- Unauthenticated `/admin/daily` reaches the Basic-auth challenge, and the editor previously authenticated successfully.
- Vercel reported no production runtime errors during the checks preceding and immediately following the scoring work.
- The public root correctly showed July 30 before midnight Pacific. A scheduled automated check will verify rollover to July 31 without a redeploy after midnight Pacific.

## Implemented gameplay state

New Standard Daily sessions use `points-v1`:

- zero through four hints map to HR, 3B, 2B, 1B, and BB;
- three wrong guesses or Give Up produces K;
- HR/3B/2B/1B/BB/K score `5/4/3/2/1/0`;
- every scheduled at-bat is played; three strikeouts do not end a new game;
- nine standard at-bats have a maximum score of 45;
- spoiler-safe raw facts preserve slot, initials, outcome, hint count, wrong guesses, and correct/strikeout/Give Up resolution;
- ruleset version flows through signed progression, local state, final results, and share output.

Compatible pre-ruleset signed/saved sessions normalize to `legacy-inning-v1`, preserving their prior three-out completion behavior. The runner/base engine remains available but does not control completion for new `points-v1` sessions.

Hints are still fetched through a server request when the player presses Hint. Removing that visible latency is the next implementation concern.

## Settled next-direction requirements

### Immediate active-at-bat hints

No visible Hint action should incur a normal network round trip.

The approved boundary is:

- all four authorized hints for the active at-bat are available locally before that at-bat appears;
- Hint presses reveal local data immediately;
- the mandatory resolution response for one at-bat may provide the next at-bat’s authorized hint bundle;
- refreshed saved sessions may hydrate the current authorized bundle before showing an interactive at-bat;
- signed progression/checkpoints preserve the actual reveal depth used for scoring;
- answers, canonical answer IDs, future reveal records, and unrelated future-player data remain server-side.

Do not add browser encryption or preload unrelated future batters merely to solve latency.

### Canonical player system and gameplay profiles

Initial Baseball should have one authoritative canonical player system, enriched with reproducibly sourced facts such as seasons, teams, statistics, Hall of Fame status, All-Star selections, awards, and approved WAR.

Objective baseball facts and product judgments remain distinct:

- factual attributes belong to `packages/baseball-data`;
- gameplay profiles describe recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual inclusion/exclusion, notes, and eventually observed solve rates;
- gameplay profiles must be editable through provider-neutral administration rather than hardcoded in React or inferred only from counting statistics.

### Recipe-driven lineups

“Standard Daily” is one lineup recipe, not the only hardcoded selector. Recipes may define slot groups with sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and optional diversity constraints.

Example: slots 1–4 may require 2010–2020 and five-plus All-Star selections, slots 5–7 may use 1990s/2000s five-plus All-Stars, and slots 8–9 may use 1980s seven-plus All-Stars.

The generator proposes. The authorized editor reviews, replaces, validates, and schedules the exact nine. Future decade, team, themed, expert, or user-selectable games may reuse the same engine, but those public modes are not committed launch scope.

### Completed results

Future aggregate results use one compact idempotent completed-game submission rather than per-action writes. Native `points-v1` state now preserves the raw facts and ruleset version needed for score distributions, solve depth, K/Give Up rates, and same-puzzle/same-ruleset percentile language.

## Remaining hosted verification

The following still require direct browser and/or authenticated editor verification and must not be claimed complete from CI alone:

- seven-day Supabase-backed horizon and missing-draft generation;
- player preview, search, replacement, and validation rerun;
- scheduling one future puzzle and confirming public consumption;
- deterministic fallback for a missing/draft record;
- ordinary hint, correct guess, incorrect guess, third strike, Give Up, all-nine continuation, refresh recovery, and final completion in a real browser;
- action-network responses and logs for leakage;
- common iPhone/iPad behavior.

## Exact next work order

1. Implement immediate active-at-bat hint bundles with focused transport, persistence, and answer-integrity tests.
2. Verify the resulting production deployment and the scheduled midnight-Pacific rollover.
3. Complete the authenticated hosted admin and full browser checklist when the editor is available.
4. Define and persist the compact completed-game submission and add same-puzzle/same-ruleset percentile comparison.
5. Define gameplay-profile and lineup-recipe contracts, then establish a conservative recognizable Standard Daily pool/recipe.
6. Continue analytics, monitoring, mobile polish, legal/domain basics, and heritage presentation.

`tasks/todo.md` is the active checklist and must remain consistent with this order.

## Open decisions

- Final point weights and whether wrong guesses receive a separate penalty; any change requires a new ruleset version.
- Exact Standard Daily slot recipe after playtesting; recognizability is settled even though thresholds are not.
- Approved sources and maintenance workflows for All-Star selections, awards, and bWAR.
- Persistence and admin UX for gameplay profiles and recipes.
- Automatic publication, emergency correction/versioning, public archive/replay, and whether themed/custom modes are eventually exposed.

## Continuity control

Repository documentation is the system of record, not chat history.

- Every PR includes a `Documentation impact` section.
- CI runs `scripts/check-docs-impact.mjs`; material changes update canonical documentation or state a specific reviewable exception.
- The check runs but is not yet a mandatory branch-ruleset requirement; issue #123 remains open after the owner chose not to activate an uncertain configuration.
- Hosted configuration, migration, deployment, or operational verification is incomplete until this file and `tasks/todo.md` reflect the verified result.
- Periodic documentation gardening compares code, issues, deployment, and canonical docs.
