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

- `packages/shared`: stable portable contracts and ruleset identifiers.
- `packages/engine`: pure outcomes, scoring/completion policies, baseball advancement, search behavior, and result calculations.
- `packages/baseball-data`: one canonical player system containing identity, aliases, factual baseball data, enrichment, source provenance, QA, and generated runtime artifacts.
- `packages/daily`: puzzle numbering, lineup recipes, selection, difficulty policy, repeat protection, lifecycle, repository/service contracts, and portable Daily transitions.
- `apps/web`: rendering, browser persistence, routes, sharing, signed-token transport, admin surfaces, server-only composition, and persistence adapters.
- Supabase/Postgres: operational persistence behind provider-neutral ports. It does not define baseball facts, scoring rules, lineup recipes, or lifecycle policy.

Canonical product behavior: `docs/product/daily-inning-blueprint.md`.  
Canonical lineup-content direction: `docs/product/lineup-content-system.md`.  
Canonical architecture: `docs/architecture-and-scale-plan.md`.  
Documentation rules: `docs/engineering/documentation-governance.md`.

## Current verified state

- PR #120 merged: the public runtime reads approved editorial puzzles through the server repository boundary.
- PR #121 merged: the Daily admin HTTP Basic challenge moved to `/admin/auth`, fixing the hosted redirect loop.
- PR #122 merged: repository continuity controls and the approved scoring, hint, recognizability, and recipe-driven lineup direction are canonical.
- Canonical production alias: `https://initial-baseball-web.vercel.app`.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview and Production.
- The `daily_editorial_puzzles` migration has been applied to the hosted Supabase project.
- Hosted table/RLS verification passed: browser roles have no CRUD access; the server service role has the intended read/write boundary and no ordinary delete path.
- Unauthenticated `/admin/daily` reaches the Basic-auth challenge, and the editor successfully authenticated into the hosted admin page.
- The latest verified production build completed hidden-answer QA for initial payloads and client chunks.
- Vercel reported no production runtime errors in the prior 24-hour window at the start of the points implementation.
- The public root correctly showed the July 30 puzzle before midnight Pacific on July 31 Eastern; an automated check is scheduled to verify rollover without a redeploy after midnight Pacific.

Hosted editorial verification is **not yet complete**. The exact seven-day horizon, draft generation, replacement, validation, scheduling, public consumption, fallback, action-network leakage checks, refresh recovery, and full browser gameplay pass still require one deliberate authenticated pass.

## Implemented gameplay state

New Standard Daily sessions use explicit `points-v1` behavior:

- zero through four revealed hints map to HR, 3B, 2B, 1B, and BB;
- three wrong guesses or Give Up produces K;
- HR/3B/2B/1B/BB/K score `5/4/3/2/1/0`;
- all scheduled at-bats are played, even after three strikeouts;
- nine standard at-bats have a maximum score of 45;
- spoiler-safe raw facts preserve slot, outcome, hint count, wrong guesses, and correct/strikeout/Give Up resolution;
- signed progression, local state, final results, and share output carry the ruleset boundary.

Already-started saved/token sessions that predate ruleset versioning normalize to `legacy-inning-v1`, preserving their prior three-out behavior rather than silently changing an in-progress game. The existing base/runner engine remains available but does not control completion for new `points-v1` games.

Hints are still fetched through a server request at button press. Immediate active-at-bat hint bundles are the next gameplay implementation concern.

## Settled next-direction requirements

### Immediate hints

No visible Hint action should incur a normal network round trip.

The preferred simple boundary is:

- all four hints for the active at-bat are locally available before that at-bat appears;
- Hint presses reveal local data immediately;
- the mandatory resolution response for one at-bat may provide the next at-bat’s authorized hint bundle;
- answers, canonical answer IDs, future reveal records, and unrelated future-player data remain server-side.

The exact transport/token representation remains an implementation detail, but the no-visible-wait product requirement is settled.

### Canonical player system and gameplay profiles

Initial Baseball should have one authoritative canonical player system, enriched over time with reproducibly sourced facts such as seasons, teams, statistics, Hall of Fame status, All-Star selections, awards, and approved WAR.

Objective baseball facts and product judgments remain distinct:

- factual attributes belong to the canonical baseball-data pipeline;
- gameplay profiles describe recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual inclusion/exclusion, notes, and eventually observed solve rates;
- gameplay profiles must be editable through a provider-neutral administration boundary rather than hardcoded into React or inferred only from counting statistics.

### Recipe-driven lineups

“Standard Daily” is one lineup recipe, not the only hardcoded selector.

A recipe can define slot groups with filters and constraints, for example:

- slots 1–4: 2010–2020 era and at least five All-Star selections;
- slots 5–7: 1990s/2000s and at least five All-Star selections;
- slots 8–9: 1980s and at least seven All-Star selections.

Recipes may filter by sourced era, team, position, Hall of Fame status, All-Star counts/years, awards, WAR thresholds, gameplay difficulty, or other approved canonical fields. They also apply repeat protection, duplicate prevention, reveal readiness, and optional diversity constraints.

The generator produces a proposal. The authorized editor can review, replace, validate, and schedule the exact nine players. Future decade, team, themed, expert, or user-selectable games may reuse the same recipe engine, but those additional public modes are not committed launch scope.

### Completed results

Future aggregate results use one compact idempotent submission per completed game, not one write per action. Native `points-v1` game state now preserves the raw per-at-bat facts and ruleset version needed for that later submission. Intended results include total score, average, outcome distribution, solve depth, K/Give Up rates, and understandable percentile language such as “You scored higher than X% of players today.”

## Exact next work order

1. Verify the merged `points-v1` production deployment, ordinary all-nine gameplay, refresh recovery, and the scheduled midnight-Pacific rollover check.
2. Complete the authenticated hosted admin/public-runtime checklist that requires the editor session.
3. Replace per-click hint fetching with active-at-bat hint bundles.
4. Define and persist the compact completed-game submission needed for score and percentile comparison.
5. Define gameplay-profile and lineup-recipe contracts, then establish a conservative Standard Daily pool/recipe.
6. Continue results UI, analytics, monitoring, mobile polish, legal/domain basics, and heritage presentation.

`tasks/todo.md` is the active ordered checklist and must remain consistent with this sequence.

## Open decisions

- Final point weights and whether wrong guesses ever receive a separate penalty; any change requires a new ruleset version.
- Exact Standard Daily slot recipe after playtesting; the recognizability principle is settled even though the thresholds are not.
- Exact approved sources and maintenance workflows for All-Star selections, awards, and bWAR.
- Exact persistence and admin UX for gameplay profiles and reusable recipes.
- Whether scheduled puzzles later publish automatically.
- Emergency correction/versioning for an already published puzzle.
- Public archive/replay behavior.
- Whether additional themed/custom game modes are eventually exposed to users.

## Continuity control

Repository documentation is the system of record, not chat history.

- Every pull request must include a `Documentation impact` section.
- CI runs `scripts/check-docs-impact.mjs`; material code or infrastructure changes must update a canonical document or state a specific reviewable exception.
- The documentation-impact check currently runs but is not configured as a mandatory branch-ruleset check; issue #123 remains open after the owner chose not to activate an uncertain ruleset configuration.
- Hosted configuration, migration, deployment, or operational verification is not complete until this file and `tasks/todo.md` reflect the verified result.
- Before beginning the next product PR, re-read the final merged diff and verify this handoff against GitHub and production.
- Periodic documentation-gardening reviews should compare code, tasks, issues, deployment, and canonical docs and open a focused correction PR when drift appears.
