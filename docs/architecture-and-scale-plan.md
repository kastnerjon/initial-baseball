# Architecture and launch-scale plan

Status: Living source of truth
Last updated: 2026-07-21

## Product goal

Initial Baseball should first become a polished, fast Daily game that is easy to send to friends and supports at least 10,000 plays per day without a rewrite. Daily Inning is the only committed product. Native clients, accounts, and head-to-head play remain possible future work, not current design drivers.

Product behavior is defined in `docs/product/daily-inning-blueprint.md`. Current resumption state is in `docs/START-HERE.md`. Documentation governance is in `docs/engineering/documentation-governance.md`.

## Operating principles

Every change should improve or protect product behavior while preserving clear ownership, portability, testability, and maintainability. Large rewrites, speculative infrastructure, duplicated rules, and undocumented architectural drift are out of scope.

## Package ownership

### `packages/shared`

Owns stable cross-platform types, schemas, settings, and serialization contracts. It does not depend on React, Next.js, browser APIs, database clients, or generated baseball data.

### `packages/engine`

Owns pure baseball and game rules: guess evaluation, outcomes, runner advancement, inning state, search algorithms, and share/result calculations. It depends only on `shared`.

### `packages/baseball-data`

Owns committed sources, canonical identity and aliases, source mappings, team identity and fan-facing display metadata, normalization, season facts, season/career aggregates, reveal cards, enrichment, QA reports, recognizability inputs, and generated runtime artifacts. Web code does not calculate, correct, or reinterpret baseball facts.

### `packages/daily`

Owns portable Daily application logic: puzzle numbering, deterministic selection, recognizability ranking, repeat protection, override validation, lineup construction, editorial validation, public editorial eligibility, selection-bound editorial puzzle identity, lifecycle invariants, the provider-neutral repository port, seven-day orchestration, and Daily transitions.

### `apps/web`

Owns Next.js pages, React components, HTTP routes, browser persistence, sharing, admin surfaces, signed-token transport authorization, server-only authorization/composition, canonical runtime access, and persistence adapters. It renders and transports domain behavior rather than defining it.

### `apps/mobile`

Remains an inactive scaffold. Shared contracts should stay platform-neutral where natural, but current work is not designed around a hypothetical native client.

### Supabase/Postgres

Supabase-hosted Postgres is the initial relational provider for editorial Daily puzzles. It stores canonical player IDs and editorial metadata behind the provider-neutral repository port. It does not own baseball facts, lineup generation, public eligibility, lifecycle transitions, answer integrity, or UI behavior.

The original broad schema in `supabase/migrations/000001_initial_schema.sql` is inactive scaffold from the former social/head-to-head direction. Its player, puzzle, pitch, attempt, result, and head-to-head tables do not back the current product and must not be silently repurposed.

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

Dependencies do not point upward. React and database clients remain absent from pure domain packages. UI does not own baseball rules, normalization, puzzle generation, editorial validation, public eligibility, or persistence semantics. The service role remains server-only.

## Canonical baseball-data architecture

```text
reviewed identity source pin
  -> checksum-manifested snapshot
  -> canonical identities and legacy redirects
  -> canonical season facts and player-season aggregates
  -> season and career cards
  -> season and career enrichment
  -> fan-facing team identity
  -> runtime player index, reveal shards, and redirects
  -> server-side accessor and safe routes
```

Names are never join keys. Source team IDs and public display identities remain separate. Known zero and unavailable data remain distinct. Rate statistics are not published from partially known source rows. Runtime artifacts join validated facts; they do not calculate baseball facts.

## Runtime serving and answer protection

The serving contract separates lightweight search data from full reveal history.

- The initial index contains identity, aliases, classification, career context, and a reveal-shard path.
- Full career and season records are split into deterministic shards.
- The server loads only the shard needed for an authorized reveal.
- Legacy IDs resolve through validated redirects.
- Legal/source names may remain aliases but are excluded from public display payloads.
- Initial page props contain only public puzzle metadata, initials, and an opaque progression token—not answers, canonical IDs, hint values, reveal records, or credentials.
- Search, hint, and resolution routes release only data authorized by the action.
- Full reveal data appears only after a correct answer, third strike, or Give Up.

### Launch progression authorization

ADR 0001 defines the accepted anonymous launch model.

- A server-signed stateless token contains only public progression claims.
- The server derives pitch, hint depth, strikes, outs, and completion from verified claims.
- Each action returns a deterministic successor token.
- The browser persists the opaque token alongside public local state.
- Replay of an earlier valid token is an accepted limitation; forged later progression is not.
- No Redis, replay cache, per-action database write, durable anonymous server session, or Vercel-specific state is added.

### Public editorial puzzle identity

The deterministic fallback keeps the established `daily-{date}` puzzle identity so existing deterministic sessions and historical behavior remain compatible. An editorial puzzle uses an opaque stable identity derived from its date and ordered canonical selection.

This distinction prevents a token issued for deterministic fallback from silently continuing after a scheduled or published editorial lineup replaces it. The editorial identity does not change when the same lineup moves from `scheduled` to `published`, because that lifecycle transition does not change the answers. A changed ordered lineup produces a different identity and invalidates tokens tied to the prior answers.

## Future-lineup administration architecture

### Portable generation and validation

`packages/daily` generates deterministic proposals from puzzle date, reviewed data version, algorithm version, recognizability rankings, recent usage, eligibility, and required-data rules. It validates slot rank bands, canonical duplicates, the 90-day repeat window, lineup shape, and reveal readiness without React or database dependencies.

### Editorial lifecycle and repository contract

`packages/daily` defines the editorial record, lifecycle, service boundary, repository port, and public-eligibility policy.

- Records contain puzzle identity/date/number, version, revision, nine canonical selections, generated/manual source, lifecycle status, and audit metadata.
- Records do not duplicate names, teams, statistics, hints, or reveal cards.
- Reads support one date and inclusive date ranges.
- Writes use expected revisions.
- Deterministic proposals begin as `draft`.
- Only drafts schedule; editing a scheduled puzzle returns it to draft and clears approval.
- Only scheduled puzzles publish; only published puzzles archive.
- Published and archived puzzles reject ordinary replacement.
- Emergency correction/versioning remains a separate future decision.
- Actor IDs and timestamps are adapter inputs; domain code does not read authentication state or clocks.

### Supabase editorial persistence

The adapter is `apps/web/app/supabaseDailyPuzzleRepository.ts`, backed by `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql`.

- One row represents one date.
- Nine selections are stored atomically as one JSONB array of `{slot, canonicalPlayerId, source}`.
- The database enforces unique date/number, status, revision, selection count, and lifecycle/audit coherence.
- The adapter decodes defensively and rejects malformed persisted state.
- Updates filter by date and expected revision; no returned row is a conflict.
- RLS is enabled with no browser policy. Access is limited to the server-side service role.
- Supabase supplies storage and atomic filtering only.

### Single-editor authorization

The initial admin method is per-request HTTP Basic authentication over HTTPS.

- `DAILY_ADMIN_USERNAME` is the stable actor ID.
- `DAILY_ADMIN_PASSWORD` must contain at least 32 characters.
- Credential comparison uses fixed-length digests and timing-safe comparison.
- Missing configuration fails closed; missing or incorrect credentials fail uniformly as unauthorized.
- Authorization occurs before constructing the privileged client or repository.
- The client reads only server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and disables browser-style session persistence.
- No Supabase Auth, OAuth, session store, password recovery, account records, or multi-editor permissions are introduced.

### Editorial web workflow

The authorized `/admin/daily` workflow supports at least the next seven lineups. It creates only missing drafts, lists the horizon, searches reviewed candidates by name/alias, preserves genuine same-name identities, previews exact initials/hints/reveal data, replaces future editable slots, reruns validation, and exposes explicit schedule, publish, and archive actions through the portable service.

`scheduled` means editorially approved. For the puzzle’s public date, either a `scheduled` or `published` record may define the public answers. This permits the public runtime to consume an approved lineup even before an explicit publication transition is automated or operationally performed. `published` remains the explicit immutable publication milestone; automatic publication remains unsettled.

Public selection rules are:

- dates before the quality launch `2026-07-22` always use the legacy deterministic selector and overrides;
- on or after launch, scheduled or published records supply ordered canonical IDs;
- missing, date-mismatched, or draft records use deterministic quality fallback;
- archived records fail closed rather than silently generating different historical answers;
- unavailable referenced canonical players fail closed;
- all repository access and joins remain server-only.

The detailed contract is in `docs/spec/public-daily-editorial-runtime.md`.

## Scale target: 10,000+ plays per day

Ten thousand Daily players is modest load if the game remains mostly static and client-driven.

- Serve immutable player/season data with CDN-friendly caching.
- Load the lightweight search index once and reveal data on demand.
- Keep anonymous game state in the client.
- Verify signed progression without persistent session state.
- Read at most the date’s editorial record during server actions; do not write per hint or guess.
- Submit at most one compact idempotent result per completed game when aggregate results are introduced.

Vercel and Supabase can support expected launch traffic if routes remain thin, cacheable where safe, and credentials isolated. They are adapters, not owners of domain behavior.

## Current product sequence

### 0. Operational deployment verification

- Configure `DAILY_PROGRESSION_SECRET` for Preview and Production.
- Apply the editorial migration and configure all server-only Supabase/admin variables.
- Redeploy once and verify signed progression, editorial selection/fallback, and `/admin/daily`.

### 1. Reveal correctness

Representative reveal correctness, team identity, and configurable columns are implemented. Continue correcting only evidence-backed data issues.

### 2. Lineup quality

The recognizability curve, 90-day repeat protection, deterministic versioning, historical preservation, and validation details are implemented.

### 3. Future-lineup administration and public consumption

The portable lifecycle, Supabase adapter, authorization, seven-day workflow, search/preview/replacement, lifecycle controls, and public scheduled/published consumption are implemented. Hosted configuration and verification remain.

### 4. Aggregate results and launch hardening

- Store one compact completed-game result.
- Add field comparison, analytics, monitoring, payload measurement, legal pages, and canonical domain configuration.
- Apply the approved heritage visual system after mechanics and administration are dependable.

## Launch-readiness requirements

Before broad distribution:

- Canonical identities/runtime payloads reproduce without an external identity fetch.
- Daily puzzles and historical overrides are deterministic and regression-tested.
- At least seven future lineups are reviewable.
- Search handles aliases, accents, ordered tokens, and genuine same-name players.
- Reveals are accurate and season-complete where sources allow.
- Hidden answers are absent from initial HTML, props, routes, logs, and share output.
- Browser counters cannot select future pitches or fabricate progression.
- A token cannot silently cross from one ordered lineup to another.
- Refresh and ordinary errors do not erase progress.
- Common iPhone/iPad layouts and spoiler-safe sharing are verified.
- One deployment is canonical and observable.

## Explicit non-goals

- Rewriting the application.
- Native mobile development now.
- Head-to-head, chat, leagues, or matchmaking.
- Microservices, queues, replay caches, or per-action persistence.
- Tamper-proof anonymous scoring claims.
- Accounts before the Daily loop is excellent.
- Automatic publication, emergency correction/versioning, or archived replay without separate decisions.

## Decision rule

Architecture cleanup is complete enough when Daily gameplay, lineup quality, administration, and presentation can improve without placing game rules, data generation, selection policy, lifecycle logic, persistence logic, or answer-integrity state directly inside React components or Next.js routes. When a decision changes, implementation, `docs/START-HERE.md`, and affected canonical documents change together.
