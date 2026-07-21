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
                        Supabase/Postgres repository adapter
```

- `packages/shared`: stable portable types and contracts.
- `packages/engine`: pure baseball/game rules, search behavior, scoring, inning transitions, and share calculations.
- `packages/baseball-data`: committed sources, canonical player identity, aliases, team and position history, season and career records, enrichment, QA, and generated runtime artifacts.
- `packages/daily`: puzzle numbering, deterministic lineup selection, recognizability, repeat protection, override validation, puzzle construction, editorial lifecycle invariants, repository/service contracts, seven-day editorial orchestration, and portable Daily transitions.
- `apps/web`: Next.js pages, React rendering, browser persistence, routes, sharing, admin surfaces, server-only authorization/composition, and the Supabase repository adapter.
- Supabase-hosted Postgres: canonical-ID-only puzzle publication and editorial persistence. It does not own baseball facts or lifecycle behavior.

Rules, baseball facts, puzzle generation, lifecycle invariants, editorial orchestration, and persistence semantics must not be moved into React components or database code. Presentation adapters may format and deduplicate labels but must not reinterpret baseball facts. Vercel and Supabase are adapters, not architectural owners.

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
- one server-runtime selector instance that caches canonical candidates, seeded 90-day history, and generated lineups;
- a provider-neutral Daily editorial record, repository port, and service contract with date-range reads, optimistic revisions, canonical-ID-only selections, explicit audit metadata, and executable lifecycle invariants;
- explicit `draft` → `scheduled` → `published` → `archived` transitions, with edited scheduled puzzles returning to draft and published/archived puzzles immutable through ordinary replacement;
- a portable seven-day editorial horizon service that creates only missing drafts, preserves existing editorial records, incorporates earlier horizon dates into repeat protection, joins current canonical review data, and returns validation warnings;
- a server-only Supabase/Postgres `DailyPuzzleRepository` adapter backed by the distinct `daily_editorial_puzzles` table, with strict persisted-row decoding, date-range reads, atomic optimistic revision updates, canonical-ID-only JSONB selections, and a row-level-security-first migration;
- a server-only single-editor administration boundary using HTTP Basic authentication over HTTPS, a stable actor ID, fail-closed credential configuration, service-role Supabase construction with browser session persistence disabled, and authorization before privileged client/repository composition.

Most recent completed product work at this handoff: PR #115, Daily admin authorization and server-only repository composition.

## Deployment state

Merged GitHub code is ahead of the last verified successful Vercel production deployment.

The production deployment attempted for PR #114's merged `main` commit failed during the Next.js build because `DAILY_PROGRESSION_SECRET` remains unset. Remaining operational task: issue #97.

- Configure one stable server-only `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production.
- Redeploy after the Vercel Hobby deployment quota permits it.
- Verify hosted hint, guess, strikeout, Give Up, refresh, and completion flows.
- Close issues #91 and #86 after successful hosted verification.

The `daily_editorial_puzzles` migration is committed but has not yet been applied to a hosted project. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_ADMIN_USERNAME`, and `DAILY_ADMIN_PASSWORD` also remain unconfigured for hosted administration. The server composition boundary exists, but no hosted admin workflow consumes it yet. The original `daily_puzzles`, `daily_puzzle_pitches`, attempt, result, database-player, and head-to-head tables remain inactive legacy scaffold and are not used by the current Daily repository.

These deployment tasks do not block coding, GitHub CI, tests, or production builds when CI supplies its nonproduction build secret.

## Current work order

1. Maintain this handoff and reconcile documentation whenever current state or roadmap priority changes.
2. Build the authorized seven-day web administration workflow using the completed authentication, lifecycle, horizon, and persistence boundaries.
3. Add player search, preview, replacement, validation reruns, and explicit schedule/publish/archive controls through service boundaries.
4. Apply the committed migration and configure hosted Supabase/Vercel environment variables when the first admin workflow is ready for deployment.
5. Add aggregate completed-game results, field comparison, monitoring, and remaining launch surfaces.
6. Apply the approved heritage visual direction after core mechanics and administration are dependable.

`tasks/todo.md` is the canonical active checklist and must remain consistent with this sequence.

## Approved decisions not yet fully implemented

### Lineup editorial horizon

- The admin workflow must support viewing and editing at least the next seven Daily lineups, not only tomorrow's lineup.
- The default operational view should make the upcoming week easy to scan.
- Draft generation may occur at least seven days ahead.
- The portable horizon service defaults to seven days but permits an adapter-supplied positive horizon length.
- Ensuring a horizon is idempotent: existing draft, scheduled, published, or archived records are preserved and only missing dates are generated.
- Earlier records in the requested horizon contribute to repeat protection for later generated dates.
- An editor can review and replace any future slot before publication.
- The first web implementation may use a manual Generate action; cron automation is optional later.

### Puzzle lifecycle

- Puzzle states are `draft`, `scheduled`, `published`, and `archived`.
- The generator proposes a deterministic draft.
- Manual edits record that a slot was editorially selected rather than generated.
- Only drafts may be scheduled, only scheduled puzzles may be published, and only published puzzles may be archived.
- Editing a scheduled puzzle returns it to draft and clears prior scheduling approval.
- Published and archived puzzles are immutable for ordinary edits.
- Repository writes use expected revisions so persistence adapters can reject lost updates.
- Actor IDs and timestamps are supplied by adapters; portable domain code does not read authentication state or clocks.
- Emergency changes require an explicit editorial/versioning action, not a silent answer replacement.
- The public game reads the approved scheduled/published puzzle for its date.
- Historical dates before the lineup-quality launch remain bound to their legacy generated answers unless an explicit future migration/versioning decision is adopted.

### Editorial persistence

- Supabase-hosted Postgres is the initial relational provider for editorial Daily puzzles.
- One `daily_editorial_puzzles` row represents one puzzle date and stores puzzle identity, lifecycle state, revision, audit metadata, and exactly nine canonical-ID selections.
- The fixed selections are stored as one JSONB value so a revision-guarded puzzle update remains atomic without a provider-specific transaction RPC.
- Names, aliases, teams, statistics, hints, and reveal records remain in baseball-data and are joined at read time.
- Updates compare both puzzle date and expected revision; a missing returned row is a concurrency conflict.
- Row-level security is enabled with no browser policies. Only the authorized server-side service-role client may access the table.
- The migration lives in `supabase/migrations/`; the adapter lives in `apps/web/app/` and implements the provider-neutral port without redefining transitions.
- The distinct table intentionally avoids destructive migration of the incompatible inactive `daily_puzzles` and `daily_puzzle_pitches` scaffold. Legacy cleanup is separate work, not part of administration implementation.

### Admin authentication and composition

- The current single-editor method is per-request HTTP Basic authentication at the Next.js server boundary and must be used only over HTTPS.
- `DAILY_ADMIN_USERNAME` is the stable editorial actor ID; `DAILY_ADMIN_PASSWORD` must contain at least 32 characters.
- Missing server configuration fails closed. Missing, malformed, or incorrect credentials fail uniformly as unauthorized.
- Future admin routes must authorize before constructing the Supabase service-role client or `DailyPuzzleRepository`.
- The privileged client uses only server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, disables browser-style session persistence, and never falls back to public variables.
- The service role, credentials, client, and repository must never be serialized to client components, browser storage, logs, or responses.
- This decision does not add public accounts, Supabase Auth, OAuth, editor sessions, password recovery, or multi-editor permissions. Those require a separate decision if the operational need changes.

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

- Pure generation, validation, lifecycle invariants, repository/service ports, and seven-day orchestration remain in `packages/daily`.
- Canonical player facts remain in `packages/baseball-data`.
- Persistence adapters implement `DailyPuzzleRepository` without redefining lifecycle rules.
- The database stores canonical player IDs and editorial metadata, not duplicate statistics.
- Web/admin adapters supply authorization and timestamps, load canonical candidates and usage history, and call portable services.
- Admin React components render returned state and dispatch actions; they do not own generation, validation, lifecycle, or persistence rules.

### Reveal behavior and team identity

- Career summary remains separate from one chronological row per regular season.
- All teams for a multi-team season remain represented.
- Hitter, pitcher, and two-way presets remain configurable; OPS and saves remain supported.
- WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags remain hidden until reproducible approved upstream sources exist.
- If Baseball Reference WAR is approved later, label it `bWAR`; never invent generic WAR from Lahman data.
- Source team IDs and fan-facing identities remain separate.
- Season-aware team mapping and audited corrections live in baseball-data, not React.

### Visual direction

The approved direction is heritage baseball rather than polished SaaS: Cooperstown and old scorecard character, Shea/municipal ballpark signage, 1970s Topps influence, paper/ink/scoreboard/ticket motifs, restrained navy/orange/aged cream/gold/field green, square borders, and utilitarian typography. Preserve the opening, active at-bat, post-at-bat reveal, and final box-score flow. Defer redesign until lineup mechanics and administration are reliable.

### Launch integrity and results

- Launch remains anonymous and client-driven.
- Signed progression blocks ordinary forged future progression but does not claim tamper-proof anonymous scoring.
- Do not add Redis, replay caches, per-action database writes, or durable anonymous sessions without a separate decision.
- Aggregate results should use at most one compact, idempotent completed-game submission.
- Raw completed-game outcomes should remain sufficient to recalculate aggregates later.

## Open decisions

- Whether scheduling/publication requires explicit editor action or may auto-publish an approved scheduled puzzle.
- Exact emergency correction/versioning workflow for a published puzzle.
- Exact source and maintenance process for recognizability rankings.
- Whether seven days remains the default generated horizon once operations begin or should be expanded.
- Whether representative UI QA should later add browser screenshots once hosted previews are available; executable data/runtime QA is already required.

Record a settled answer here and in the appropriate canonical document in the same PR that adopts it.

## Known issues and follow-ups

- Issue #97: configure and verify the production/preview Daily progression secret.
- The Daily editorial migration and administration variables still need a hosted Supabase project/application and Vercel configuration.
- Inactive legacy Supabase scaffold remains committed and should be removed only through separate, dependency-aware cleanup.
- Vercel Hobby deployment quota may temporarily prevent hosted previews; GitHub CI remains available.

## New-conversation prompt

> Continue work on `kastnerjon/initial-baseball`. First read `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md` from current GitHub `main`. Verify latest merged PRs, open PRs, open issues, CI, and Vercel deployment state before acting. Treat `docs/START-HERE.md` as the durable handoff. The exact next bounded concern is building the authorized seven-day web administration workflow on the completed HTTP Basic authorization boundary, portable lifecycle/horizon services, `daily_editorial_puzzles` schema, and server-only Supabase repository composition. Do not restart settled lineup, lifecycle, horizon, persistence, or single-editor authentication architecture; expose credentials or the service role to the browser; build current features against inactive legacy Supabase tables; let Supabase redefine domain behavior; silently change published historical answers; begin emergency correction/versioning implicitly; or start the heritage redesign before administration is dependable. Keep documentation current in the same PR whenever product behavior, architecture, data contracts, administration, deployment state, or roadmap priority changes.

## Maintenance rule

Update this file when the latest meaningful milestone, deployment state, current work order, approved deferred decisions, open decisions, operational blockers, or standard continuation prompt changes. Do not add routine implementation history or duplicate entire canonical specifications.
