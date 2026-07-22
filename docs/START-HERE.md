# Initial Baseball — Start Here

Status: Active project handoff
Last updated: 2026-07-21

Use this file to resume work. It records current state, settled future requirements, unresolved decisions, and exact next work. Pull requests and `tasks/lessons.md` retain history.

## Resume protocol

1. Read `AGENTS.md`.
2. Read this file.
3. Read `tasks/todo.md`.
4. Verify current GitHub `main`, open pull requests, relevant issues, CI, Vercel, and hosted configuration.
5. Read only the canonical documents and source files needed for the next bounded task.
6. Write the repository scope contract before implementation.
7. Complete one owning concern per pull request.

Do not restart settled architecture discussions because the conversation changed. If this handoff conflicts with code or another canonical document, inspect the latest merged PRs and correct the drift first.

## Product and architecture

Initial Baseball currently means one committed product: **Daily Inning**, a browser-first daily baseball guessing game. Everyone receives the same nine-player puzzle for the date. Each at-bat begins with initials and up to four ordered hints. Correct answers yield HR, 3B, 2B, 1B, or BB based on hints used; three wrong guesses or Give Up produces a strikeout. The pure engine owns runner advancement, outs, hits, walks, and runs. A resolved at-bat shows canonical career and regular-season data; completion produces spoiler-safe share output. Accounts, streaks, native apps, and head-to-head play remain deferred.

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

- `packages/shared`: stable portable contracts.
- `packages/engine`: pure baseball/game rules, search behavior, scoring, inning transitions, and share calculations.
- `packages/baseball-data`: canonical identity, aliases, baseball facts, recognizability inputs, career/season records, enrichment, QA, and generated runtime artifacts.
- `packages/daily`: puzzle numbering, deterministic selection, lineup quality, repeat protection, editorial public-eligibility policy, lifecycle invariants, repository/service contracts, seven-day orchestration, and portable Daily transitions.
- `apps/web`: Next.js/React rendering, browser persistence, routes, sharing, server-only authorization/composition, public runtime composition, and the Supabase repository adapter.
- Supabase/Postgres stores canonical-ID-only editorial records and metadata. It does not own baseball facts, selection policy, or lifecycle behavior.

React and routes do not define baseball, puzzle-selection, lifecycle, or persistence rules. Service-role credentials remain server-only. Vercel and Supabase are adapters, not architectural owners.

Canonical product behavior: `docs/product/daily-inning-blueprint.md`.
Canonical architecture: `docs/architecture-and-scale-plan.md`.
Public editorial runtime contract: `docs/spec/public-daily-editorial-runtime.md`.
Source ownership map: `docs/engineering/source-map.md`.

## Current verified implementation state

The repository now includes:

- canonical player identity, redirects, pinned reproducible source inputs, season/career facts, reveal cards, enrichment, runtime payloads, and representative data QA;
- canonical server-side name search, guarded hints, answer resolution, terminal reveal delivery, and hidden-answer production-build QA;
- schema-3 browser-save recovery and anonymous stateless signed progression authorization;
- career summaries, chronological regular-season rows, multi-team seasons, two-way display, hitter OPS, pitcher saves, configurable reveal columns, and season-aware fan-facing team identity;
- a versioned nine-slot lineup-quality contract with canonical duplicate detection, required-data validation, non-overlapping recognizability bands, and a 90-day repeat window;
- lineup-quality launch date `2026-07-22`; dates before it continue reproducing the legacy selector and historical overrides;
- a provider-neutral editorial record and repository port with optimistic revisions, canonical-ID-only selections, explicit audit metadata, and `draft` → `scheduled` → `published` → `archived` lifecycle invariants;
- a seven-day editorial horizon service that creates only missing drafts, preserves existing records, includes earlier horizon dates in repeat protection, joins review data, and returns validation warnings;
- a server-only Supabase adapter backed by `daily_editorial_puzzles`, strict row decoding, atomic revision-guarded writes, and RLS-first migration;
- fail-closed single-editor HTTP Basic authorization, stable actor ID, server-only service-role composition, and authorization before privileged client/repository construction;
- authorized `/admin/daily` generation, seven-day review, player search, same-name disambiguation, exact preview, future-slot replacement, validation reruns, and explicit schedule/publish/archive controls;
- a public Daily selection policy in `packages/daily` and server composition in `apps/web` that read the editorial repository by date, use only `scheduled` or `published` canonical selections, retain deterministic fallback when no approved record exists, preserve all pre-launch legacy answers, exclude drafts, and refuse to reinterpret archived records until a replay/versioning policy is settled;
- an unchanged browser bootstrap contract containing only public puzzle metadata, initials, and an opaque progression token. Hidden IDs, answers, hints, reveal data, and credentials remain server-side.

Most recent completed product work on `main`: PR #119, explicit authorized lifecycle controls.
Current in-flight work: public editorial Daily runtime PR from branch `agent/public-editorial-daily-runtime`.

## Deployment and hosted configuration

GitHub `main` is ahead of the last verified successful Vercel production deployment.

Vercel deployment capacity has recovered: a fresh preview for the public-runtime branch was accepted, compiled successfully, and passed Next.js type checking. It then failed during page-data collection because `DAILY_PROGRESSION_SECRET` is still unset. Issue #97 remains the operational blocker.

Required hosted work:

- configure one stable server-only `DAILY_PROGRESSION_SECRET` for Preview and Production;
- apply `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql` to the hosted Supabase project;
- configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_ADMIN_USERNAME`, and a `DAILY_ADMIN_PASSWORD` of at least 32 characters;
- trigger one deliberate deployment after configuration;
- verify hosted bootstrap, hint, correct guess, third strike, Give Up, refresh, completion, editorial fallback, scheduled/published selection, and `/admin/daily` workflows;
- close issues #91 and #86 only after successful hosted verification.

The available connected tools have not verified or configured the hosted Supabase migration or required environment variables. Do not infer that they exist. The original `daily_puzzles`, `daily_puzzle_pitches`, attempt, result, database-player, and head-to-head tables remain inactive legacy scaffold.

## Current work order

1. Complete and merge the bounded public editorial Daily runtime PR after focused review and full CI.
2. Configure the progression secret, apply the hosted editorial migration, configure all server-only administration variables, deploy once, and verify signed gameplay plus `/admin/daily` end to end.
3. Add aggregate completed-game results, field comparison, monitoring, and remaining launch surfaces.
4. Apply the approved heritage visual direction after mechanics, administration, and hosted operation are dependable.

`tasks/todo.md` is the canonical active checklist and must remain consistent with this sequence.

## Settled requirements to preserve

### Editorial horizon and lifecycle

- The admin workflow covers at least the next seven lineups; the default horizon is seven but adapters may supply another positive length.
- Horizon generation is idempotent: only missing dates become drafts; existing records are preserved; earlier horizon dates contribute to repeat protection.
- Editors may replace future slots before publication. Manual replacements are marked manual.
- Only drafts schedule, only scheduled records publish, and only published records archive.
- Editing a scheduled record returns it to draft and clears scheduling approval.
- Published and archived records are immutable through ordinary replacement.
- Repository writes use expected revisions. Adapters supply actor IDs and timestamps.
- Emergency changes require an explicit future correction/versioning action.

### Public puzzle selection

- Dates before `2026-07-22` always use the legacy deterministic selector/override path, even if an editorial row exists.
- On or after launch, only `scheduled` and `published` editorial rows may define public answers.
- Draft, missing, or date-mismatched rows use the deterministic quality-selector fallback.
- Archived rows do not silently fall back or redefine history; public replay remains unavailable until an explicit archived-history/versioning policy is adopted.
- Persisted canonical IDs are joined to current canonical baseball data on the server. Missing referenced players fail closed.
- The repository read and service-role client remain server-only. Public bootstrap and action responses retain existing spoiler-safe contracts.

### Persistence and authorization

- One `daily_editorial_puzzles` row represents one date and stores puzzle identity, lifecycle state, revision, audit metadata, and exactly nine canonical-ID selections in one JSONB value.
- Names, aliases, teams, stats, hints, and reveals remain in baseball-data and are joined at read time.
- RLS remains enabled with no browser policies; only the server-side service role may access the table.
- `DAILY_ADMIN_USERNAME` is the stable actor ID. Missing configuration fails closed; malformed or wrong credentials fail uniformly as unauthorized.
- Authorization occurs before constructing the privileged client/repository. Credentials, keys, clients, and repository objects are never serialized, logged, or stored in the browser.
- No Supabase Auth, OAuth, editor sessions, password recovery, public accounts, or multi-editor permissions are introduced without a separate decision.

### Reveal, data, and visual direction

- Career summary remains separate from one chronological row per regular season; all teams for multi-team seasons remain represented.
- Hitter, pitcher, and two-way presets remain configurable; OPS and saves remain supported.
- WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags remain hidden until reproducible approved sources exist. Any future Baseball Reference WAR must be labeled `bWAR`.
- Source team IDs and fan-facing identities remain separate; corrections belong in baseball-data, not React.
- The approved visual direction is heritage baseball—scorecard, municipal ballpark signage, and 1970s card character—not polished SaaS. Redesign remains deferred.

### Launch integrity and results

- Launch remains anonymous and client-driven. Signed progression blocks ordinary forged future progression but does not claim tamper-proof scoring.
- Do not add Redis, replay caches, durable anonymous sessions, or per-action database writes without a separate decision.
- Aggregate results should use at most one compact idempotent completed-game submission and preserve raw outcomes sufficient to recalculate aggregates.

## Open decisions

- Whether scheduled puzzles should later publish automatically or continue to require explicit editor action.
- Exact emergency correction/versioning workflow for a published puzzle.
- Exact public replay policy for archived editorial puzzles.
- Exact source and maintenance process for recognizability rankings.
- Whether the generated horizon should remain seven days once operations begin.
- Whether representative UI QA should add browser screenshots after hosted previews are operational.

## Known issues

- Issue #97: configure and verify the Preview/Production progression secret.
- Hosted editorial migration and administration variables remain unverified/unconfigured.
- Hosted signed progression and admin workflows remain unverified.
- Inactive legacy Supabase scaffold remains committed and should be removed only through separate dependency-aware cleanup.

## Maintenance rule

Update this file when the latest milestone, deployment state, work order, settled deferred decisions, open decisions, operational blockers, or continuation prompt changes. Do not add routine implementation history or duplicate entire specifications.
