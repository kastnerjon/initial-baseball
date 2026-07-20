# Architecture and launch-scale plan

Status: Living source of truth
Last updated: 2026-07-20

## Product goal

Initial Baseball should first become a polished, fast Daily game that is easy to send to friends and enjoyable enough to share. Daily Inning is the only committed product.

A future native client or head-to-head game remains possible, not active scope. The architecture target is a browser-first codebase that supports rapid product iteration, reliable Daily gameplay, and at least 10,000 plays per day without requiring a rewrite.

The end-to-end product behavior is defined in `docs/product/daily-inning-blueprint.md`. Documentation rules are defined in `docs/engineering/documentation-governance.md`.

## Operating principles

Every change should answer two questions:

1. Does it improve or protect the product behavior?
2. Does it preserve clear ownership, portability, testability, and maintainability?

Architecture work remains behavior-preserving unless a PR explicitly changes product behavior. Large rewrites, speculative infrastructure, and duplicated rules are out of scope.

## Package ownership

### `packages/shared`

Owns stable cross-platform types, schemas, settings, and serialization contracts. It must not depend on React, Next.js, browser APIs, database clients, or generated baseball data.

### `packages/engine`

Owns pure baseball and game rules: guess evaluation, outcomes, runner advancement, inning state, search algorithms, and share/result calculations. It depends only on `shared`.

### `packages/baseball-data`

Owns committed baseball sources, canonical identity, aliases, source mappings, normalization, season facts, season and career aggregates, reveal cards, enrichment, data-quality reports, and generated runtime-serving artifacts.

It may generate browser-consumable outputs, but web code must not generate, correct, or reinterpret baseball facts.

### `packages/daily`

Owns Daily-specific portable application logic: puzzle numbering, deterministic lineup selection, recognizability ranking, override validation, puzzle construction, and Daily session transitions. It may depend on `shared`, `engine`, and `baseball-data` where the package contract permits.

### `apps/web`

Owns Next.js pages, React components, HTTP routes, browser persistence, sharing, and web-specific infrastructure adapters. It renders and transports domain behavior rather than defining it.

### `apps/mobile`

Remains an inactive scaffold. Shared contracts should stay platform-neutral where natural, but current work must not be designed around a hypothetical native client.

### Database and repository adapters

Publication lifecycle, admin persistence, completed-game results, and eventual accounts belong behind explicit repository/service boundaries. Database clients do not belong inside React components, the engine, or pure Daily logic.

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
                        database adapters
```

Dependencies must not point upward.

- React and Next.js are absent from domain packages.
- Database and network clients are absent from `engine` and pure Daily behavior.
- UI does not own baseball rules, player normalization, puzzle generation, or persistence semantics.
- Baseball-data generation is not owned by `apps/web`.

## Canonical baseball-data architecture

The replacement player-data pipeline is ordered by ownership and data grain:

```text
canonical identities
  -> Lahman-first canonical universe and legacy redirects
  -> canonical season source facts
  -> canonical player-season aggregates
  -> canonical season cards
  -> canonical career aggregates
  -> canonical career cards
  -> canonical season and career enrichment
  -> canonical runtime player index, reveal shards, and valid redirects
  -> web runtime migration
```

Rules:

- Identity owns the canonical player ID, display name, aliases, and source mappings.
- Season cards own regular-season teams, positions, and direct season facts.
- Season enrichment owns season-level derived or separately sourced values.
- Career records summarize accepted season data rather than becoming a second source of truth.
- Runtime artifacts join validated records; they do not calculate baseball facts.
- Names are never join keys.
- Known zero and unavailable data remain distinct.
- A rate statistic is not published from partially known contributing source rows.

The canonical pipeline is currently a shadow system. The live game remains on the legacy generated player objects until a dedicated migration changes its consumers and compatibility paths.

## Runtime serving and answer protection

The canonical serving contract separates lightweight search data from full reveal history.

- The initial index contains identity, aliases, classification, career context, and a reveal-shard path.
- Full career and regular-season reveal records are split into deterministic shards.
- A consumer fetches only the shard needed for a selected or safely revealed player.
- Legacy IDs resolve through validated redirects whose targets actually have runtime records.
- Legal/source names remain searchable aliases but are excluded from the display payload.

The web migration must preserve hidden-answer integrity. A valid runtime artifact is not permission to serialize the answer's full reveal record into initial HTML or client props before the at-bat is resolved.

## Scale target: 10,000+ plays per day

Ten thousand Daily players is modest systems load if the game remains mostly static and client-driven.

### Keep the hot path cheap

- Serve immutable player and season data with CDN-friendly caching.
- Load the lightweight search index once and reveal data on demand.
- Keep anonymous gameplay state in the client.
- Avoid a database write for every reveal, incorrect guess, or base transition.
- Submit at most one compact, idempotent result per completed game when aggregate statistics are introduced.

### Avoid unnecessary infrastructure

The initial launch does not require microservices, queues, a dedicated mobile backend, real-time subscriptions, or server-side game sessions. Vercel plus a small relational database can support expected traffic if routes remain thin and cacheable.

Vercel is an adapter for hosting and deployment, not the owner of domain behavior, baseball data, persistence contracts, or the public domain.

### Preserve concrete seams

Admin, publication, aggregate results, and accounts should use repository interfaces so the persistence provider can be replaced without moving database behavior into React or game rules.

Do not create an abstraction solely for an imagined future mode. Extract a boundary when Daily needs it or when a second concrete consumer exists.

## Current stabilization sequence

### 1. Canonical runtime payload

- Complete source-row completeness fixes for season and career rates.
- Generate a lightweight index, reveal shards, redirect filtering, manifests, and strict QA.
- Keep the artifact shadow-only until review and migration are complete.

### 2. Web runtime migration

- Add baseball-data accessors for the canonical index and reveal shards.
- Migrate search, answer resolution, saved state, and historical overrides through canonical IDs and redirects.
- Add same-name disambiguation and hidden-answer leakage tests.
- Retire legacy paths only after compatibility coverage passes.

### 3. Reveal presentation

- Render a career summary plus one ordered row per regular season.
- Use hitter, pitcher, and two-way display presets.
- Keep unsupported fields hidden until upstream canonical data supplies them.

### 4. Lineup quality and administration

- Enforce the nine-slot recognizability curve and repeat protection.
- Make tomorrow's generated lineup reviewable and replaceable.
- Persist draft, scheduled, published, and archived states behind a repository boundary.

### 5. Aggregate results and launch hardening

- Store one compact completed-game result.
- Add field comparison, analytics, error monitoring, payload measurement, legal pages, and canonical domain configuration.

## Launch-readiness requirements

Before broad friend distribution:

- Daily puzzles and historical overrides are deterministic and regression-tested.
- Tomorrow's lineup is editorially reviewable before publication.
- Search handles aliases, accents, ordered tokens, and genuine same-name players.
- Player reveal data is accurate, understandable, and season-complete where sources allow.
- Hidden answers are absent from initial HTML, serialized props, routes, logs, and share output.
- Static and immutable responses use caching.
- Refresh and ordinary errors do not erase local progress.
- The full web game is polished at common iPhone and iPad sizes.
- Share output is reliable and spoiler-safe.
- One deployment is canonical and observable.
- Repeated play does not require per-action server state.

## Explicit non-goals

- Rewriting the engine or application from scratch.
- Building a native mobile application now.
- Building head-to-head gameplay, chat, leagues, or matchmaking.
- Introducing microservices or queues.
- Persisting every anonymous gameplay action.
- Adding accounts before the anonymous Daily loop is excellent.
- Creating abstractions without a concrete upcoming consumer.

## Decision rule

Architecture cleanup is complete enough when the product team can improve the visible Daily experience without placing game rules, data generation, puzzle lifecycle logic, or persistence logic directly inside React components or Next.js routes.

When a decision changes, implementation and affected canonical documents must change in the same pull request.
