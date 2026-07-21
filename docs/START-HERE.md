# Initial Baseball — Start Here

Status: Active project handoff
Last updated: 2026-07-21

Use this file to resume work in a new conversation or by a new contributor. It records current state, approved future decisions, unresolved decisions, and the exact next work. It is not a history log. Pull requests and `tasks/lessons.md` retain historical rationale.

## Resume protocol

Before changing code:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `tasks/todo.md`.
4. Verify current GitHub `main`, open pull requests, relevant issues, and CI.
5. Read only the canonical documents and source files needed for the next bounded task.
6. Write the repository scope contract before implementation.
7. Complete one owning concern per pull request unless the user explicitly approves a different scope.

Do not restart settled architecture discussions merely because the conversation changed. If this file conflicts with code or a canonical document, inspect the latest merged pull requests and correct the drift before proceeding.

## Current product

Initial Baseball currently means one committed product: **Daily Inning**, a browser-first daily baseball guessing game.

- Everyone receives the same nine-player puzzle for the Daily date.
- Each at-bat begins with initials and supports up to four ordered hints.
- Correct answers yield HR, 3B, 2B, 1B, or BB based on hints used.
- Three incorrect guesses or Give Up produces a strikeout.
- The engine advances runners, outs, hits, walks, and runs.
- A resolved at-bat shows a canonical career summary and expandable regular-season statistics.
- The completed game produces spoiler-safe share output.
- Accounts, streaks, native apps, and head-to-head play are deferred.

Canonical product behavior: `docs/product/daily-inning-blueprint.md`.

## Current architecture

```text
shared
  ├── engine
  └── baseball-data
         \
          daily
            \
             web / API / admin adapters
                       \
                        database adapters
```

- `packages/shared`: stable portable types and contracts.
- `packages/engine`: pure baseball/game rules, search behavior, scoring, inning transitions, and share calculations.
- `packages/baseball-data`: committed sources, canonical player identity, aliases, team and position history, season and career records, enrichment, QA, and generated runtime artifacts.
- `packages/daily`: puzzle numbering, deterministic lineup selection, recognizability, repeat protection, override validation, puzzle construction, and portable Daily transitions.
- `apps/web`: Next.js pages, React rendering, browser persistence, routes, sharing, admin surfaces, and provider-specific adapters.
- Database/repository adapters: puzzle publication lifecycle, admin persistence, completed-game results, and eventual accounts.

Rules, baseball facts, puzzle generation, and persistence semantics must not be moved into React components. Presentation adapters may format and deduplicate labels but must not reinterpret baseball facts. Vercel is a hosting adapter, not an architectural owner.

Canonical architecture: `docs/architecture-and-scale-plan.md`.
Source ownership map: `docs/engineering/source-map.md`.

## Current verified implementation state

Completed foundation and mechanics include:

- canonical player identity and legacy redirects;
- pinned, checksum-verified identity inputs for reproducible local, preview, production, and CI builds;
- canonical season facts, season aggregates, season cards, career aggregates, career cards, enrichment, and runtime payloads;
- canonical server-side search, hint, answer resolution, and terminal reveal delivery;
- hidden-answer production-build QA;
- safe browser-save migration and schema-3 progression-token persistence;
- anonymous stateless signed progression authorization;
- career summaries, regular-season rows, multi-team season representation, two-way batting/pitching display, hitter OPS, pitcher saves, and configurable reveal columns;
- centralized season-aware team identities preserving source IDs while supplying fan-facing abbreviations and names;
- executable representative reveal QA for Ortiz, Rivera, Ohtani, Griffey, Wright, Mays, Campanella, and distinct Ben Taylor records;
- audited 2016-and-later Angels display-name correction, unique rendered career abbreviations, and safe fallback for older schema-1 artifacts;
- a portable, versioned nine-slot Daily lineup quality contract with canonical duplicate detection, reveal-readiness validation, and a 90-day repeat window;
- production canonical selection using non-overlapping recognizability bands: ranks 1-250 for slots 1-2, 251-1,000 for 3-4, 1,001-2,500 for 5-6, and 2,501-5,000 for 7-9;
- an explicit lineup-quality launch date of `2026-07-22`, with all earlier published dates continuing to reproduce the legacy selector rather than silently changing answers;
- one server-runtime selector instance that caches canonical candidates, seeded 90-day history, and generated lineups, so hints and guesses do not replay historical generation.

Most recent completed product work at this handoff: issue #61 / PR #111, production Daily lineup quality integration.

## Deployment state

Merged GitHub code is ahead of the last verified Vercel production deployment.

Remaining operational task: issue #97.

- Configure one stable server-only `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production.
- Redeploy after the Vercel Hobby deployment quota permits it.
- Verify hosted hint, guess, strikeout, Give Up, refresh, and completion flows.
- Close issues #91 and #86 after successful hosted verification.

This deployment task does not block coding, GitHub CI, tests, or production builds.

## Current work order

1. Maintain this handoff and reconcile documentation whenever current state or roadmap priority changes.
2. Define the provider-neutral editorial puzzle lifecycle and repository/service boundary.
3. Build the seven-day lineup administration workflow.
4. Add aggregate completed-game results, field comparison, monitoring, and remaining launch surfaces.
5. Apply the approved heritage visual direction after core mechanics and administration are dependable.

`tasks/todo.md` is the canonical active checklist and must remain consistent with this sequence.

## Approved decisions not yet fully implemented

### Lineup editorial horizon

- The admin workflow must support viewing and editing at least the next seven Daily lineups, not only tomorrow's lineup.
- The default operational view should make the upcoming week easy to scan.
- Draft generation may occur at least seven days ahead.
- An editor can review and replace any future slot before publication.
- The first implementation may use a manual Generate action; cron automation is optional later.

### Puzzle lifecycle

- Puzzle states are `draft`, `scheduled`, `published`, and `archived`.
- The generator proposes a deterministic draft.
- Manual edits record that a slot was editorially selected rather than generated.
- Published puzzles are immutable for ordinary edits.
- Emergency changes require an explicit editorial/versioning action, not a silent answer replacement.
- The public game reads the approved scheduled/published puzzle for its date.
- Historical dates before the lineup-quality launch remain bound to their legacy generated answers unless an explicit future migration/versioning decision is adopted.

### Admin lineup screen

For each future date, show:

- Daily date and puzzle number;
- lifecycle status;
- all nine slots and expected recognizability band;
- canonical player ID, display name, career years, player type, primary position, and fan-facing teams;
- recognizability rank and most recent Daily usage;
- generated/manual selection source;
- required-data and quality warnings.

The editor must be able to search by name or alias, distinguish same-name players, preview initials/hints/reveal, replace a slot, rerun validation, and approve or schedule future puzzles.

### Admin ownership

- Pure generation and validation remain in `packages/daily`.
- Canonical player facts remain in `packages/baseball-data`.
- Persistence sits behind a `DailyPuzzleRepository` or equivalent explicit repository boundary.
- The database stores canonical player IDs and editorial metadata, not duplicate statistics.
- Admin React components call services/adapters and do not own generation, validation, or persistence rules.

### Reveal behavior and team identity

- Career summary remains separate from one chronological row per regular season.
- All teams for a multi-team season remain represented.
- Hitter, pitcher, and two-way presets remain configurable; OPS and saves remain supported.
- WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags remain hidden until reproducible approved upstream sources exist.
- If Baseball Reference WAR is approved later, label it `bWAR`; never invent generic WAR from Lahman data.
- Source team IDs and fan-facing identities remain separate.
- Season-aware team mapping and audited corrections live in baseball-data, not React.
- Runtime records expose source IDs plus abbreviations and display names; presentation may deduplicate repeated labels.

### Visual direction

The approved direction is heritage baseball rather than polished SaaS: Cooperstown and old scorecard character, Shea/municipal ballpark signage, 1970s Topps influence, paper/ink/scoreboard/ticket motifs, restrained navy/orange/aged cream/gold/field green, square borders, and utilitarian typography. Preserve the opening, active at-bat, post-at-bat reveal, and final box-score flow. Defer redesign until lineup mechanics and administration are reliable.

### Launch integrity and results

- Launch remains anonymous and client-driven.
- Signed progression blocks ordinary forged future progression but does not claim tamper-proof anonymous scoring.
- Do not add Redis, replay caches, per-action database writes, or durable anonymous sessions without a separate decision.
- Aggregate results should use at most one compact, idempotent completed-game submission.
- Raw completed-game outcomes should remain sufficient to recalculate aggregates later.

## Open decisions

- Admin authentication method.
- Exact relational database/provider for puzzle persistence; Supabase/Postgres is plausible but not selected merely because scaffolding exists.
- Whether scheduling/publication requires explicit editor action or may auto-publish an approved scheduled puzzle.
- Exact emergency correction/versioning workflow for a published puzzle.
- Exact source and maintenance process for recognizability rankings.
- Whether seven days is the default generated horizon or only the minimum editable horizon.
- Whether representative UI QA should later add browser screenshots once hosted previews are available; executable data/runtime QA is already required.

Record a settled answer here and in the appropriate canonical document in the same PR that adopts it.

## Known issues and follow-ups

- Issue #97: configure and verify the production/preview Daily progression secret.
- Vercel Hobby deployment quota may temporarily prevent hosted previews; GitHub CI remains available.

## New-conversation prompt

> Continue work on `kastnerjon/initial-baseball`. First read `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md` from current GitHub `main`. Verify latest merged PRs, open PRs, open issues, and CI before acting. Treat `docs/START-HERE.md` as the durable handoff. The exact next bounded concern is the provider-neutral editorial puzzle lifecycle and repository/service boundary, followed by the seven-day lineup administration workflow. Do not restart settled lineup architecture, silently change published historical answers, choose a database provider before defining the contract it must satisfy, or begin the heritage redesign before administration is dependable. Keep documentation current in the same PR whenever product behavior, architecture, data contracts, administration, or roadmap priority changes.

## Maintenance rule

Update this file when the latest meaningful milestone, deployment state, current work order, approved deferred decisions, open decisions, operational blockers, or standard continuation prompt changes. Do not add routine implementation history or duplicate entire canonical specifications.
