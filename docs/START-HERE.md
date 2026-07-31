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

- shared: portable contracts and version identifiers;
- engine: outcomes, scoring/completion, runner rules, search, and results;
- baseball-data: canonical facts, enrichment, provenance, QA, and runtime artifacts;
- daily: future profiles/recipes, selection, repeats, validation, lifecycle, and repository/service ports;
- web: rendering, browser state, signed authorization, active hint bundles, routes, admin, and persistence adapters;
- Supabase: operational persistence, not baseball facts or product rules.

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Lineup content: `docs/product/lineup-content-system.md`.  
Architecture: `docs/architecture-and-scale-plan.md`.  
Answer integrity: `docs/decisions/0001-daily-answer-integrity.md`.

## Current verified state

- PRs #120–#122 are merged; editorial public consumption, hosted Basic auth, and repository continuity controls are established.
- PR #124 introduced versioned `points-v1`; PR #125 reconciled its verified production deployment.
- PR #126 is merged at main SHA `e5f5a37ca7e21df8abfa93f9559eae27921567fc`; active-batter hints are preauthorized and Hint clicks are local.
- Production deployment `dpl_DLPirNAwyebFCmyD7cf6xU4MPBnJ` is `READY` and canonically aliased to `https://initial-baseball-web.vercel.app`.
- Production HTML was verified to show `0/45 PTS`, `0/9 AB`, a signed `points-v1` base token, exactly one active four-hint bundle, and signed reveal-depth checkpoints.
- The production initial payload contained no answer ID/name, canonical reveal record, credential, service-role data, or unrelated future-batter hint bundle.
- The production build passed hidden-answer QA for two initial payloads and 21 client chunks. Build QA also verified that the active client no longer contains the exact legacy `/api/daily/hint` request.
- PR #126 passed typecheck, all tests, file-size checks, the complete canonical data/runtime pipeline, production build, Vercel preview, and bounded review. Both P1 review findings were fixed before merge.
- Production runtime-error checks after the hint deployment reported no errors.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview/Production.
- `daily_editorial_puzzles` migration and RLS/service-role checks passed.
- Unauthenticated `/admin/daily` reaches the challenge and the editor previously authenticated.
- A scheduled check will verify rollover to July 31 after midnight Pacific without a redeploy.

## Implemented gameplay

New Standard Daily sessions use `points-v1`:

- HR/3B/2B/1B/BB/K = `5/4/3/2/1/0`;
- all nine scheduled at-bats are played;
- raw facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/K/Give Up resolution;
- ruleset version flows through token, local state, result, and share output;
- compatible old sessions remain `legacy-inning-v1` with prior three-out behavior.

### Immediate active-batter hints

- Bootstrap sends all four current-batter hints plus signed later-depth checkpoints.
- Hint clicks reveal local data and adopt the corresponding signed token without a network request.
- Incorrect guesses return a refreshed same-pitch bundle with updated strike claims.
- Correct/K/Give Up returns only the next pitch’s bundle unless complete.
- Compatible saved progress hydrates only its verified current bundle through `POST /api/daily/hints` before becoming interactive.
- The legacy one-hint route remains server-compatible but is absent from the active client.
- Answers, canonical IDs, reveal records, credentials, and unrelated future-batter hints remain server-side.

A technical user may inspect all current-batter hints and replay a prior valid token. That remains within the accepted anonymous noncompetitive model; stronger competition requires server-authoritative attempts.

## Settled future systems

### Canonical player facts versus gameplay profiles

One authoritative canonical player system is enriched from reproducible sources. Objective facts stay in baseball-data. Editable gameplay profiles separately describe recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual promotion/exclusion, notes, and later observed solve rates.

### Recipe-driven lineups

Standard Daily is one versioned recipe, not the only selector. Recipes may define slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and diversity constraints. The generator proposes; the editor reviews, replaces, validates, and schedules the exact nine.

### Completed results

Future aggregation uses one compact idempotent completed-game submission from native raw facts and ruleset version. The server validates puzzle identity and internal fact consistency and derives the score rather than trusting a submitted total. Percentiles compare the same puzzle and ruleset. No per-action database writes.

## Remaining hosted verification

These require a real browser and/or authenticated editor session and must not be inferred from CI or HTML inspection:

- saved-session `/api/daily/hints` hydration and refresh recovery through an actual browser lifecycle;
- correct guess, wrong guesses, third strike, Give Up, all-nine continuation, final reveal/completion, and mobile interaction;
- seven-day Supabase horizon, missing-draft generation, player preview/search/replacement, validation, scheduling, public consumption, and deterministic fallback;
- action-level network/log inspection during those flows.

## Exact next work order

1. Complete the authenticated admin and full real-browser checklist when the editor is available.
2. Define the compact completed-game submission, validation, idempotent repository port, and derived-score contract in portable layers.
3. Add a separate Supabase migration/adapter and public submission route only after that contract is reviewed.
4. Add same-puzzle/same-ruleset aggregates and percentile UI.
5. Define gameplay-profile and lineup-recipe contracts, then establish a conservative recognizable Standard Daily pool/recipe.
6. Continue analytics, monitoring, mobile polish, legal/domain basics, and heritage presentation.

## Open decisions

- Final point weights and any wrong-guess penalty; changes require a new ruleset version.
- Exact percentile tie treatment and minimum sample display.
- Exact Standard Daily recipe thresholds after playtesting.
- Approved All-Star/award/bWAR source workflows.
- Persistence/admin UX for profiles and recipes.
- Automatic publication, emergency correction, archive/replay, and eventual themed/custom public modes.

## Continuity control

Repository docs are the system of record. Every PR has Documentation impact; CI checks material diffs; hosted work is incomplete until START-HERE/todo are reconciled. The documentation-impact check is not yet mandatory branch protection; issue #123 remains open after the owner declined an uncertain ruleset configuration.
