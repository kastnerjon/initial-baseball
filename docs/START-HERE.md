# Initial Baseball — Start Here

Status: Active project handoff
Last updated: 2026-07-21

Use this file to resume work in a new conversation or by a new contributor. It records current state, approved future decisions, unresolved decisions, and the exact next work. It is not a history log. Pull requests and `tasks/lessons.md` retain historical rationale.

## Resume protocol

Before changing code:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `tasks/todo.md`.
4. Verify the current GitHub `main`, open pull requests, and relevant open issues.
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

Rules, baseball facts, puzzle generation, and persistence semantics must not be moved into React components. Vercel is a hosting adapter, not an architectural owner.

Canonical architecture: `docs/architecture-and-scale-plan.md`.
Source ownership map: `docs/engineering/source-map.md`.

## Current verified implementation state

Completed foundation and mechanics include:

- canonical player identity and legacy redirects;
- pinned, checksum-verified identity inputs for reproducible local, preview, production, and CI builds;
- canonical season facts, season aggregates, season cards, career aggregates, career cards, enrichment, and runtime payloads;
- canonical server-side search, hint, answer resolution, and terminal reveal delivery;
- hidden-answer production-build QA;
- canonical duplicate prevention in Daily lineups;
- safe browser-save migration and schema-3 progression-token persistence;
- anonymous stateless signed progression authorization;
- career summaries, regular-season rows, multi-team season representation, two-way batting/pitching display, hitter OPS, pitcher saves, and configurable reveal columns.

Most recent completed product PR at this handoff: PR #100, configurable reveal columns.

## Deployment state

Merged GitHub code is ahead of the last verified Vercel production deployment.

Remaining operational task: issue #97.

- Configure one stable server-only `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production.
- Redeploy after the Vercel Hobby deployment quota permits it.
- Verify the hosted hint, guess, strikeout, Give Up, refresh, and completion flows.
- Close issues #91 and #86 after successful hosted verification.

This deployment task does not block coding, GitHub CI, tests, or production builds.

## Current work order

1. Maintain this handoff and reconcile documentation whenever current state or roadmap priority changes.
2. Correct team display abbreviations centrally in baseball-data; raw Lahman identifiers such as `LAN`, `NYA`, and `NYN` must not leak into fan-facing display where `LAD`, `NYY`, and `NYM` are appropriate.
3. Complete representative reveal QA for David Ortiz, Mariano Rivera, Shohei Ohtani, Ken Griffey Jr., David Wright, Willie Mays, and both Ben Taylor identities.
4. Finalize lineup mechanics:
   - at-bats 1–2: top 250 recognizability;
   - at-bats 3–4: top 1,000;
   - at-bats 5–6: top 2,500;
   - at-bats 7–9: top 5,000;
   - no duplicate canonical player;
   - avoid players used in the previous 90 days;
   - deterministic output for date plus reviewed data version;
   - historical overrides and saved references remain resolvable.
5. Define and persist the editorial puzzle lifecycle.
6. Build the lineup administration workflow.
7. Add aggregate completed-game results, field comparison, monitoring, and remaining launch surfaces.
8. Apply the approved heritage visual direction after core mechanics and administration are dependable.

`tasks/todo.md` is the canonical active checklist and must remain consistent with this sequence.

## Approved decisions not yet fully implemented

These are settled product intentions. Do not drop them merely because implementation is several pull requests away.

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

### Admin lineup screen

For each future date, show:

- Daily date and puzzle number;
- lifecycle status;
- all nine slots;
- expected recognizability band per slot;
- canonical player ID and display name;
- career years;
- player type and primary position;
- teams using fan-facing display abbreviations;
- recognizability rank;
- most recent Daily usage;
- whether selection was generated or manual;
- required-data and quality warnings.

The editor must be able to:

- search players by name or alias;
- distinguish genuine same-name players using career years, positions, and teams;
- filter or warn based on slot recognizability;
- preview initials and ordered hints;
- preview the complete reveal card;
- replace a slot;
- rerun duplicate, repeat-window, rank, and required-data validation;
- approve/schedule future puzzles.

### Admin ownership

- Pure generation and validation remain in `packages/daily`.
- Canonical player facts remain in `packages/baseball-data`.
- Persistence sits behind a `DailyPuzzleRepository` or equivalent explicit repository boundary.
- The database stores canonical player IDs and editorial metadata, not duplicate copies of player statistics.
- Admin React components call services/adapters and do not own generation, validation, or persistence rules.

### Visual direction

The approved visual direction is heritage baseball rather than polished SaaS:

- Cooperstown and old scorecard character;
- Shea Stadium / municipal ballpark signage;
- 1970s Topps card influence;
- paper, ink, scoreboard, ticket, and scorecard motifs;
- restrained navy, orange, aged cream, gold, and field green;
- square borders and utilitarian typography rather than rounded dashboard cards.

The visual redesign is intentionally deferred until lineup mechanics and administration are reliable. Preserve the underlying screen flow: opening, active at-bat, post-at-bat player reveal, and final box score.

### Reveal behavior

- Career summary remains separate from season rows.
- One chronological row per regular season.
- All teams for a multi-team season remain represented.
- Hitter, pitcher, and two-way presets remain configurable.
- OPS and saves remain supported.
- WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags remain hidden until reproducible approved upstream sources exist.
- If Baseball Reference WAR is approved later, label it `bWAR`; never invent a generic WAR field from Lahman data.

### Team identity and display

- Source team identifiers and fan-facing abbreviations are separate concepts.
- Preserve source IDs for traceability.
- Add a centralized baseball-data display mapping rather than patching strings in React.
- Mapping must account for historical team identity and season context where necessary.
- Web, admin, reveal generation, and future clients should consume the same display representation.

### Launch integrity and results

- Launch remains anonymous and client-driven.
- Signed progression blocks ordinary forged future progression but does not claim tamper-proof anonymous scoring.
- Do not add Redis, replay caches, per-action database writes, or durable anonymous sessions without a separate decision.
- Aggregate results should use at most one compact, idempotent completed-game submission.
- Raw completed-game outcomes should remain sufficient to recalculate aggregates later.

## Open decisions

These are genuinely unresolved and should be decided when the related implementation becomes concrete.

- Admin authentication method.
- Exact relational database/provider for puzzle persistence; Supabase/Postgres is plausible but not selected merely because scaffolding exists.
- Whether scheduling and publication require an explicit editor action or may auto-publish an already approved scheduled puzzle.
- Exact emergency correction/versioning workflow for a published puzzle.
- Exact source and maintenance process for recognizability rankings.
- Exact historical team-display data model where one source identifier spans multiple public identities or abbreviations.
- Whether seven days is the default generated horizon or merely the minimum editable horizon.
- Whether representative UI QA is component/fixture based, browser screenshot based, or both once hosted previews are available.

Record a settled answer here and in the appropriate canonical document in the same PR that adopts it.

## Known issues and follow-ups

- Issue #97: configure and verify the production/preview Daily progression secret.
- Team abbreviations currently leak Lahman-style IDs in reveal displays (`LAN`, `NYA`, `NYN`, and likely others). Fix centrally in baseball-data after a full mapping audit.
- Representative reveal QA remains incomplete.
- Vercel Hobby deployment quota temporarily prevents new hosted previews; GitHub CI remains available.

## New-conversation prompt

Use this prompt in a new project conversation:

> Continue work on `kastnerjon/initial-baseball`. First read `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md` from the current GitHub `main`. Verify the latest merged PRs, open PRs, open issues, and CI state before acting. Treat `docs/START-HERE.md` as the concise handoff: preserve its approved-but-not-yet-implemented decisions, distinguish them from genuinely open decisions, and correct any drift you find. Continue the exact next bounded item in the documented work order using one owning concern per PR. Do not restart settled architecture discussions, do not insert a new foundation phase without a concrete blocker, and do not begin the heritage visual redesign before lineup mechanics and administration are dependable. Keep documentation current in the same PR whenever product behavior, architecture, data contracts, administration, or roadmap priority changes.

## Maintenance rule

Update this file when any of the following changes:

- latest meaningful completed milestone;
- deployment state;
- current work order;
- an approved deferred decision;
- a genuinely open decision;
- an operational blocker;
- the standard new-conversation prompt.

Do not add routine implementation history or duplicate entire canonical specifications. Link to deeper documents and keep this file usable as a fast handoff.