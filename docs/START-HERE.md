# Initial Baseball — Start Here

Status: Active project handoff  
Last updated: 2026-08-29

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
- PR #126 introduced immediate active-batter hints; PR #127 reconciled that production state.
- PR #128 merged as `9ba0a44198799fe71b0520d5245b16b39e056fc2` and made `points-v2` the current Standard Daily policy.
- PR #131 added immediate Give Up feedback plus server-side editorial-read caching.
- PR #132 merged as `a942bab74a68077a1c6ed1aff37b16af45ccc685`; Submit Guess now immediately shows `Checking…`.
- PR #133 merged as `543adf1038f780313870ed3ff30c163648bd86f3`; the public resolve hot path now caches the fully materialized Daily puzzle, defers heavyweight lineup/Supabase composition to cache misses, separates search initialization from resolution, avoids full canonical-index validation for ordinary canonical guesses, and uses direct reveal-shard access for terminal reveals.
- Production deployment `dpl_AyXpSu9VyQaVUrmANTqJVNQVFf4k` is `READY` on exact PR #133 merge SHA `543adf1038f780313870ed3ff30c163648bd86f3` at `https://initial-baseball-web.vercel.app`; its production build passed hidden-answer QA.
- Real-device QA before PR #133 observed roughly two seconds end-to-end for Submit Guess despite successful 200 resolution requests. The post-optimization production iPhone timing retest is still required; do not infer latency improvement from CI/build success.
- The scheduled August 1 rollover observation verified that production advanced from July 31, 2026 / Daily #96 to August 1, 2026 / Daily #97 after midnight Pacific without a coincident redeploy. Deployment `dpl_Bp2gX76FqxQXpjCgAbMY76nUyqwC` remained current, and the post-boundary response served the correct puzzle through Vercel revalidation.
- The initial production payload retains exactly one current-batter four-hint bundle and contains no answer ID/name, canonical reveal record, credential, service-role data, or unrelated future-batter hint bundle.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview/Production.
- `daily_editorial_puzzles` migration and RLS/service-role checks passed.
- Unauthenticated `/admin/daily` reaches the challenge and the editor previously authenticated.

## Implemented gameplay

New Standard Daily sessions use `points-v2`:

- HR/3B/2B/1B/BB/K = `4/3/2/1/0.5/0`;
- all nine scheduled at-bats are played;
- the resolved at-bat shows both its baseball outcome and awarded points;
- raw facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/K/Give Up resolution;
- ruleset version flows through token, local state, result, and share output;
- compatible `points-v1` sessions retain `5/4/3/2/1/0` and a 45-point maximum;
- compatible old sessions remain `legacy-inning-v1` with prior three-out behavior and no misleading point copy.

### Immediate active-batter hints

- Bootstrap sends all four current-batter hints plus signed later-depth checkpoints.
- Hint clicks reveal local data and adopt the corresponding signed token without a network request.
- Incorrect guesses return a refreshed same-pitch bundle with updated strike claims.
- Correct/K/Give Up returns only the next pitch’s bundle unless complete.
- Compatible saved progress hydrates only its verified current bundle through `POST /api/daily/hints` before becoming interactive.
- The legacy one-hint route remains server-compatible but is absent from the active client.
- Answers, canonical IDs, reveal records, credentials, and unrelated future-batter hints remain server-side.

A technical user may inspect all current-batter hints and replay a prior valid token. That remains within the accepted anonymous noncompetitive model; stronger competition requires server-authoritative attempts.

### Resolution responsiveness

- Give Up immediately changes to `Revealing…` while the existing authorized resolution request completes.
- Submit Guess immediately changes to `Checking…` while its authorized resolution request completes; the correctness decision remains server-side.
- `POST /api/daily/resolve` retains its handler-level `Server-Timing` duration; comparing it with the phone's end-to-end latency helps identify remaining browser/network/platform-startup overhead.
- The server caches the fully materialized public `DailyPuzzle` by date, with a 300-second safety revalidation window. Successful authenticated admin saves invalidate that cache.
- On a materialized-puzzle cache hit, resolution does not re-query Supabase, rebuild the nine-player puzzle, rank the Daily candidate universe, or initialize the public lineup source.
- Player-search candidates are constructed only on the search path rather than during resolve runtime composition.
- Ordinary canonical-format guesses compare directly with the server-only canonical answer ID. Legacy/noncanonical guesses still cross the canonical redirect boundary.
- Terminal correct/K/Give Up resolution reads only the deterministic reveal shard for the answer instead of loading the full canonical player index solely to locate the reveal.
- These are server/runtime optimizations only: Supabase remains editorial authority, progression/scoring rules are unchanged, and answers/reveal records remain server-side until terminal resolution.
- Production mobile latency improvement remains unverified until the same real-device flow is repeated after PR #133.

### Public visual presentation

The public Daily surface now uses the modern heritage scorecard direction recorded in `docs/product/daily-inning-blueprint.md`: warm paper, clubhouse green, muted scorekeeper red, restrained gold, a real masthead/edition lockup, sticky scoreboard treatment, a dominant active-batter initials panel, scorecard-like hints/history, tactile controls, and baseball-card/stat-table reveals.

The visual pass is presentation-only. It does not change scoring, progression, answer authority, baseball facts, persistence, publication, or search semantics. Search suggestions overlay the page instead of shifting it; selecting a player suppresses the misleading empty-results state; the placeholder outcome-distribution card is absent until real aggregate results exist. Common iPhone/iPad visual and interaction QA remains required on the deployed build.

## Settled future systems

### Canonical player facts versus gameplay profiles

One authoritative canonical player system is enriched from reproducible sources. Objective facts stay in baseball-data. Editable gameplay profiles separately describe recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual promotion/exclusion, notes, and later observed solve rates.

### Recipe-driven lineups

Standard Daily is one versioned recipe, not the only selector. Recipes may define slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and diversity constraints. The generator proposes; the editor reviews, replaces, validates, and schedules the exact nine.

### Completed results

Future aggregation uses one compact idempotent completed-game submission from native raw facts and ruleset version. The server validates puzzle identity and internal fact consistency and derives the score rather than trusting a submitted total. Percentiles compare the same puzzle and ruleset. No per-action database writes.

## Remaining verification

### Public real-browser gameplay

These require an actual browser lifecycle but no editor credentials:

- re-test Submit Guess and Give Up latency on production after PR #133, inspecting handler-level server timing against end-to-end phone timing;
- verify the heritage Daily presentation and touch behavior on common iPhone/iPad sizes, including sticky scorebug, hints, search dropdown, selected-player state, result/reveal cards, scorecard history, and completion/share;
- resolved `points-v2` outcome/point presentation;
- saved-session `/api/daily/hints` hydration and refresh recovery;
- correct guess, wrong guesses, third strike, Give Up responsiveness/reveal, all-nine continuation, final reveal/completion, and mobile interaction;
- action-level network/log inspection during those flows.

### Authenticated editorial workflow

These require the editor's authenticated session:

- seven-day Supabase horizon and missing-draft generation;
- player preview/search/replacement and validation;
- scheduling one future puzzle and verifying public scheduled/published consumption;
- deterministic fallback for missing/draft records.

## Exact next work order

1. Merge/deploy the bounded heritage Daily UI pass after CI/preview/review, then complete the production iPhone/iPad presentation check together with the outstanding PR #133 latency retest and public browser/refresh/completion checklist.
2. Complete the authenticated admin checklist when the editor is available.
3. Define the compact completed-game submission, validation, idempotent repository port, and derived-score contract in portable layers.
4. Add a separate Supabase migration/adapter and public submission route only after that contract is reviewed.
5. Add same-puzzle/same-ruleset aggregates and percentile UI using the established heritage visual system.
6. Define gameplay-profile and lineup-recipe contracts, then establish a conservative recognizable Standard Daily pool/recipe.
7. Continue analytics, monitoring, legal/domain basics, and later refinement of the established mobile/heritage presentation.

## Open decisions

- Any future point-weight or wrong-guess-penalty change requires a new ruleset version.
- Exact percentile tie treatment and minimum sample display.
- Exact Standard Daily recipe thresholds after playtesting.
- Approved All-Star/award/bWAR source workflows.
- Persistence/admin UX for profiles and recipes.
- Automatic publication, emergency correction, archive/replay, and eventual themed/custom public modes.

## Continuity control

Repository docs are the system of record. Every PR has Documentation impact; CI checks material diffs; hosted work is incomplete until START-HERE/todo are reconciled. The documentation-impact check is not yet mandatory branch protection; issue #123 remains open after the owner declined an uncertain ruleset configuration.
