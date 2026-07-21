# Architecture and launch-scale plan

Status: Living source of truth
Last updated: 2026-07-21

## Product goal

Initial Baseball should first become a polished, fast Daily game that is easy to send to friends and enjoyable enough to share. Daily Inning is the only committed product.

A future native client or head-to-head game remains possible, not active scope. The architecture target is a browser-first codebase that supports rapid product iteration, reliable Daily gameplay, and at least 10,000 plays per day without requiring a rewrite.

The end-to-end product behavior is defined in `docs/product/daily-inning-blueprint.md`. Documentation rules are defined in `docs/engineering/documentation-governance.md`. Current resumption state and approved deferred decisions are summarized in `docs/START-HERE.md`.

## Operating principles

Every change should answer:

1. Does it improve or protect product behavior?
2. Does it preserve clear ownership, portability, testability, and maintainability?

Large rewrites, speculative infrastructure, duplicated rules, and undocumented architectural drift are out of scope.

## Package ownership

### `packages/shared`

Owns stable cross-platform types, schemas, settings, and serialization contracts. It must not depend on React, Next.js, browser APIs, database clients, or generated baseball data.

### `packages/engine`

Owns pure baseball and game rules: guess evaluation, outcomes, runner advancement, inning state, search algorithms, and share/result calculations. It depends only on `shared`.

### `packages/baseball-data`

Owns committed baseball sources, canonical identity, aliases, source mappings, team identity and fan-facing display metadata, normalization, season facts, season and career aggregates, reveal cards, enrichment, data-quality reports, and generated runtime-serving artifacts.

It may generate client-consumable outputs, but web code must not generate, correct, or reinterpret baseball facts. Raw source identifiers may be retained for provenance while public display fields are supplied through the canonical data layer.

### `packages/daily`

Owns Daily-specific portable application logic: puzzle numbering, deterministic lineup selection, recognizability ranking, repeat protection, override validation, puzzle construction, editorial validation, editorial lifecycle invariants, the provider-neutral repository port, seven-day editorial orchestration, and Daily session transitions. It may depend on `shared`, `engine`, and `baseball-data` where the package contract permits.

### `apps/web`

Owns Next.js pages, React components, HTTP routes, browser persistence, sharing, admin surfaces, and web-specific infrastructure adapters. It renders and transports domain behavior rather than defining it. Stateless progression-token signing and verification belong here because they authorize web transport rather than define baseball or Daily rules. The server-only Supabase repository adapter also belongs here because it implements a web deployment concern behind the portable Daily port. Single-editor administration authorization and privileged-client composition belong here because they protect a web-only server boundary rather than define editorial lifecycle behavior.

### `apps/mobile`

Remains an inactive scaffold. Shared contracts should stay platform-neutral where natural, but current work must not be designed around a hypothetical native client.

### Database and repository adapters

Puzzle publication lifecycle, future-lineup administration, completed-game results, and eventual accounts belong behind explicit repository/service boundaries. Database clients do not belong inside React components, the engine, baseball-data generation, or pure Daily logic.

Supabase-hosted Postgres is the initial relational provider for editorial Daily puzzles. The current `daily_editorial_puzzles` table stores canonical player IDs and editorial metadata. It does not become a second store of player names, statistics, teams, hints, or reveal records.

The original broad schema in `supabase/migrations/000001_initial_schema.sql` is inactive scaffold from the former head-to-head/social direction. Its database-player, `daily_puzzles`, `daily_puzzle_pitches`, attempt, and result tables do not back the current Daily runtime or editorial repository. Current work must not silently repurpose or extend them.

## Dependency direction

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

Dependencies must not point upward.

- React and Next.js are absent from domain packages.
- Database and network clients are absent from `engine` and pure Daily behavior.
- UI does not own baseball rules, player normalization, puzzle generation, editorial validation, or persistence semantics.
- Baseball-data generation is not owned by `apps/web`.
- Admin components call services/repositories rather than reading or writing persistence directly.
- The Supabase service role remains server-only and is never exposed to browser code.
- Admin requests are authorized before the privileged Supabase client or repository is constructed.

## Canonical baseball-data architecture

```text
reviewed external identity source pin
  -> committed checksum-manifested identity snapshot
  -> materialized canonical identities
  -> Lahman-first canonical universe and legacy redirects
  -> canonical season source facts
  -> canonical player-season aggregates
  -> canonical season cards
  -> canonical career aggregates
  -> canonical career cards
  -> canonical season and career enrichment
  -> canonical team display identity
  -> canonical runtime player index, reveal shards, and valid redirects
  -> server-side web runtime accessor and safe transport routes
```

Rules:

- Identity owns canonical player IDs, display names, aliases, and source mappings.
- Source team IDs and public display abbreviations are separate fields when necessary.
- Normal local, preview, and production builds materialize committed reviewed inputs without a Chadwick network fetch.
- CI independently regenerates identities from the reviewed pin and requires exact equality.
- Season cards own regular-season teams, positions, and direct season facts.
- Season enrichment owns season-level derived or separately sourced values.
- Career records summarize accepted season data rather than becoming a second source of truth.
- Runtime artifacts join validated records; they do not calculate baseball facts.
- Names are never join keys.
- Known zero and unavailable data remain distinct.
- A rate statistic is not published from partially known contributing rows.

The canonical pipeline is the live identity, search, answer-resolution, and reveal source. Legacy player objects remain temporary inputs only where recognizability or hint construction has not yet received a canonical contract.

## Runtime serving and answer protection

The serving contract separates lightweight search data from full reveal history.

- The initial index contains identity, aliases, classification, career context, and a reveal-shard path.
- Full career and regular-season reveal records are split into deterministic shards.
- The server accessor loads only the shard needed for a safely revealed player.
- Legacy IDs resolve through validated redirects.
- Legal/source names may remain searchable aliases but are excluded from public display payloads.
- Initial page props contain public puzzle metadata, initials, and an opaque progression token—not answers, hint values, or reveal records.
- Search, hint, and resolution routes release only data authorized by the current action.

Full reveal data is returned only after a correct answer, third strike, or Give Up.

### Launch progression authorization

ADR 0001 defines the accepted anonymous launch model, implemented in PRs #95 and #96.

- A server-signed stateless token contains only public progression claims.
- The server derives current pitch, hint depth, strikes, outs, and completion from verified claims rather than browser counters.
- Each valid action returns a deterministic successor token.
- The browser persists the opaque token alongside public local state.
- The token contains no hidden answer or hint data.
- Replay of an earlier valid token is an accepted launch limitation; forged later progression or arbitrary future-pitch selection is not.
- Signing and verification remain provider-neutral web adapters using a server-only secret.

This model adds no replay cache, Redis, per-action database write, durable anonymous server session, or Vercel-specific state.

## Future-lineup administration architecture

The editorial system has separate portable, persistence, and web concerns.

### Portable generation and validation

`packages/daily` generates a deterministic proposal from:

- puzzle date;
- reviewed data version;
- recognizability rankings;
- recent Daily usage;
- eligibility and required-data rules.

It validates slot rank bands, canonical duplicates, the repeat window, and reveal readiness without React or database dependencies.

### Editorial lifecycle and repository contract

`packages/daily` defines the provider-neutral editorial record, lifecycle rules, service boundary, and `DailyPuzzleRepository` port.

- Records contain puzzle identity, date, number, explicit version and revision, nine canonical player IDs, generated/manual selection source, lifecycle status, and editorial audit metadata.
- Records do not duplicate player names, teams, statistics, hints, or reveal cards.
- Repository reads support one date and an inclusive date range for the seven-day workflow.
- Repository writes use an expected revision so adapters can reject lost updates.
- A deterministic proposal is created as `draft`.
- Only a `draft` may become `scheduled`.
- Editing a `scheduled` puzzle records the replacement as manual and returns the puzzle to `draft`, requiring fresh approval.
- Only a `scheduled` puzzle may become `published`.
- Only a `published` puzzle may become `archived`.
- Published and archived puzzles reject ordinary slot replacement.
- Emergency correction/versioning is deliberately separate from ordinary editing and remains an explicit future decision.
- Actor IDs and timestamps are inputs to the portable service; domain code does not read platform clocks or authentication state.

A database adapter implements the repository port and its uniqueness/concurrency guarantees. A web/admin application service supplies authorization context through the server composition boundary, calls the portable service, joins canonical player display data for review, and formats responses. React renders returned state and dispatches actions; it does not implement lifecycle or persistence rules.

### Supabase/Postgres editorial persistence

The initial adapter is `apps/web/app/supabaseDailyPuzzleRepository.ts`, backed by `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql`.

- One `daily_editorial_puzzles` row represents one puzzle date.
- Puzzle identity, number, version, revision, status, audit fields, and nine selections are persisted.
- The selections are one fixed JSONB array of `{slot, canonicalPlayerId, source}` values. This keeps each repository save atomic without adding a provider-specific transaction RPC or duplicating baseball facts.
- The database enforces unique puzzle dates and puzzle numbers, valid statuses, revision bounds, nine selections, and lifecycle/audit-field coherence.
- The adapter decodes rows defensively and rejects malformed persisted state rather than manufacturing domain data.
- Inserts map unique-date or unique-number violations to repository conflicts.
- Updates filter by both puzzle date and expected revision; no returned row means the optimistic write lost a race.
- Updates do not rewrite immutable puzzle identity, date, number, version, or creation audit fields.
- Row-level security is enabled with no browser policy. Access is limited to a server-side Supabase service-role client behind the authorized admin composition boundary.
- Supabase supplies storage and atomic filtering only. It does not define lifecycle transitions, generation, validation, or publication behavior.
- The distinct table avoids destructive alteration of the incompatible legacy `daily_puzzles` and `daily_puzzle_pitches` foreign-key graph. Legacy removal or migration is separate dependency-aware cleanup.

### Single-editor authorization and server composition

The initial administration method is per-request HTTP Basic authentication at the Next.js server boundary. This is the smallest method appropriate for one editor and must be used only over HTTPS.

- `DAILY_ADMIN_USERNAME` identifies the single editor and becomes the stable actor ID supplied to portable editorial services.
- `DAILY_ADMIN_PASSWORD` must contain at least 32 characters and remains server-only.
- Credential comparison uses fixed-length digests and timing-safe comparison.
- Missing or incorrect credentials fail uniformly as unauthorized; missing server configuration fails closed as a distinct operational error.
- Authorization occurs before `createServerSupabaseClient` or `createSupabaseDailyPuzzleRepository` is called.
- The privileged client reads only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, never public `NEXT_PUBLIC_*` values, and disables browser-style session persistence.
- Future admin routes translate unauthorized errors to HTTP `401` with the exported Basic challenge. They do not return credentials, the Supabase client, or the service-role key.
- No account records, Supabase Auth integration, OAuth provider, session store, password recovery, or multi-editor authorization model is introduced.
- If the product needs multiple editors, revocation, individual permissions, or durable editor sessions, replace this boundary through a separate explicit authentication decision rather than extending portable domain packages.

### Editorial web workflow

The admin workflow must support at least the next seven Daily lineups.

- A generated lineup begins as `draft`.
- An editor may replace any future slot.
- Approved future puzzles become `scheduled`.
- The public puzzle for the date becomes `published` and is immutable for ordinary edits.
- Past puzzles become `archived`.
- Emergency corrections require an explicit versioned editorial action.
- The authorized `/admin/daily` workflow reads the seven-day horizon, creates only missing drafts, searches reviewed candidates by name or alias, preserves genuine same-name identities, previews exact initials/hints/canonical reveal data, replaces editable future slots through the portable service, and returns rerun validation.
- The next bounded implementation adds explicit schedule, publish, and archive controls without settling automatic publication or emergency correction/versioning.

## Scale target: 10,000+ plays per day

Ten thousand Daily players is modest systems load if the game remains mostly static and client-driven.

- Serve immutable player and season data with CDN-friendly caching.
- Load the lightweight search index once and reveal data on demand.
- Keep anonymous gameplay state in the client.
- Verify progression tokens without a persistence round trip.
- Avoid a database write for every hint, incorrect guess, or base transition.
- Submit at most one compact, idempotent result per completed game when aggregate statistics are introduced.

The initial launch does not require microservices, queues, a dedicated mobile backend, real-time subscriptions, replay storage, or server-side game sessions. Vercel plus Supabase-hosted Postgres can support expected traffic if routes remain thin, cacheable where safe, and server credentials remain isolated.

Vercel and Supabase are hosting and persistence adapters, not owners of domain behavior, baseball data, persistence contracts, answer-integrity state, or the public domain.

## Current product sequence

### 0. Operational deployment verification

- Configure `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production.
- Redeploy and verify the merged signed-progression flow.
- This does not block GitHub development.

### 1. Reveal correctness

- Normalize fan-facing team display metadata centrally.
- Complete representative reveal QA across hitters, pitchers, two-way players, historical players, and same-name identities.

### 2. Lineup quality

- Enforce the nine-slot recognizability curve.
- Enforce the approved 90-day repeat window.
- Preserve deterministic output for date plus reviewed data version.
- Produce editorial validation details.

### 3. Future-lineup administration

- Persist `draft`, `scheduled`, `published`, and `archived` states through the provider-neutral repository contract and Supabase/Postgres adapter.
- Authorize the single editor and expose the seven-day review and missing-draft workflow through the server-only repository boundary.
- Search, preview, replacement, and validation reruns are complete through that boundary; add explicit schedule/publish/archive controls next.
- Keep published puzzles immutable absent an explicit versioned editorial action.

### 4. Aggregate results and launch hardening

- Store one compact completed-game result.
- Add field comparison, analytics, error monitoring, payload measurement, legal pages, and canonical domain configuration.
- Apply the approved heritage visual system after mechanics and administration are dependable.

No additional foundation phase should be inserted unless a concrete correctness or launch blocker requires it.

## Launch-readiness requirements

Before broad friend distribution:

- The same commit produces the same canonical identities and runtime payload without an external identity-source fetch.
- Daily puzzles and historical overrides are deterministic and regression-tested.
- At least the next seven lineups are editorially reviewable before publication.
- Search handles aliases, accents, ordered tokens, and genuine same-name players.
- Player reveal data is accurate, season-complete where sources allow, and uses approved public team display identity.
- Hidden answers are absent from initial HTML, serialized props, routes, logs, and share output.
- Browser counters cannot select a future pitch or fabricate server-authorized progression.
- Refresh and ordinary errors do not erase progress.
- The full web game is polished at common iPhone and iPad sizes.
- Share output is reliable and spoiler-safe.
- One deployment is canonical and observable.
- Repeated play does not require per-action server state.

## Explicit non-goals

- Rewriting the engine or application from scratch.
- Building a native mobile application now.
- Building head-to-head gameplay, chat, leagues, or matchmaking.
- Introducing microservices, queues, replay caches, or per-action persistence.
- Claiming tamper-proof anonymous scoring.
- Adding accounts before the anonymous Daily loop is excellent.
- Creating abstractions without a concrete upcoming consumer.

## Decision rule

Architecture cleanup is complete enough when the team can improve Daily gameplay, lineup quality, administration, and presentation without placing game rules, data generation, puzzle lifecycle logic, persistence logic, or answer-integrity state directly inside React components or Next.js routes.

When a decision changes, implementation, `docs/START-HERE.md`, and affected canonical documents must change together.
