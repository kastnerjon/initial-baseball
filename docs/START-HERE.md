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

- `packages/shared`: stable portable contracts.
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
- PR #122 establishes repository continuity controls and records the approved scoring, hint, recognizability, and recipe-driven lineup direction.
- Production deployment `dpl_DuUXDL6pBSG4aCG7iniDHn97vQGE` is `READY` for the current application behavior.
- Canonical production alias: `https://initial-baseball-web.vercel.app`.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview and Production.
- The `daily_editorial_puzzles` migration has been applied to the hosted Supabase project.
- Hosted table/RLS verification passed: browser roles have no CRUD access; the server service role has the intended read/write boundary and no ordinary delete path.
- Unauthenticated `/admin/daily` reaches the Basic-auth challenge, and the editor successfully authenticated into the hosted admin page.

Hosted verification is **not yet complete**. The exact seven-day horizon, draft generation, replacement, validation, scheduling, public consumption, fallback, gameplay progression, refresh recovery, and leakage/runtime-error checks still require one deliberate end-to-end pass. The public root also showed a stale Daily date/cache discrepancy that must be understood before relying on publication behavior.

## Implemented gameplay state

The current production implementation still:

- maps zero through four revealed hints to HR, 3B, 2B, 1B, and BB;
- gives three strikes or Give Up a K;
- advances runners and tracks runs, hits, outs, and strikeouts;
- may complete after three outs;
- fetches each hint through a server request at button press.

Those facts describe current code, not the approved next direction below.

## Settled next-direction requirements

### Flexible scoring and completion

Scoring weights and completion behavior are product-tuning choices, not permanent assumptions embedded throughout the application.

- Preserve stable raw at-bat facts: slot, outcome, hints revealed, wrong guesses, correct/strikeout/give-up resolution, and puzzle identity.
- Apply a versioned scoring/completion policy to those facts.
- Provisional alpha policy: HR/3B/2B/1B/BB/K = `5/4/3/2/1/0`, and every player completes all nine at-bats.
- A future baseball-inning policy may reuse runner advancement and three-out completion without rewriting unrelated UI, data, or results systems.
- Percentile comparisons must compare the same puzzle under the same ruleset version.

Exact point weights remain tunable after playtesting.

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

Future aggregate results use one compact idempotent submission per completed game, not one write per action. Preserve raw per-at-bat facts and ruleset version so alternative score formulas can be evaluated or historical aggregates recalculated. Intended results include total score, average, outcome distribution, solve depth, K/Give Up rates, and understandable percentile language such as “You scored higher than X% of players today.”

## Exact next work order

1. Complete hosted admin and public-runtime verification, including the public date/cache discrepancy.
2. Add the versioned scoring/completion boundary and provisional all-nine points policy.
3. Replace per-click hint fetching with active-at-bat hint bundles.
4. Define and persist the compact completed-game facts needed for score and percentile comparison.
5. Define gameplay-profile and lineup-recipe contracts, then establish a conservative Standard Daily pool/recipe.
6. Continue results UI, analytics, monitoring, mobile polish, legal/domain basics, and heritage presentation.

`tasks/todo.md` is the active ordered checklist and must remain consistent with this sequence.

## Open decisions

- Final point weights and whether wrong guesses ever receive a separate penalty.
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
- Hosted configuration, migration, deployment, or operational verification is not complete until `docs/START-HERE.md` and `tasks/todo.md` reflect the verified result.
- Before beginning the next product PR, re-read the final merged diff and verify this handoff against GitHub and production.
- Periodic documentation-gardening reviews should compare code, tasks, issues, deployment, and canonical docs and open a focused correction PR when drift appears.
