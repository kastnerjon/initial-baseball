# Architecture and launch-scale plan

Status: Living architecture source of truth  
Last updated: 2026-07-31

## Product goal

Build a polished, fast Daily game that can support at least 10,000 plays per day without a rewrite. Daily Inning is the only committed product, while inexpensive seams may support future themed or alternate games.

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Lineup content system: `docs/product/lineup-content-system.md`.  
Current handoff: `docs/START-HERE.md`.  
Documentation governance: `docs/engineering/documentation-governance.md`.

## Operating principles

- Humans decide product intent and acceptance criteria; agents execute bounded work.
- Repository-local, versioned knowledge is the system of record.
- Establish stable contracts for facts, outcomes, recipes, and persistence; keep tuning choices replaceable.
- Enforce ownership and dependency direction mechanically where practical.
- Prefer small reviewed PRs, focused tests, observable browser QA, and explicit operational verification.
- Do not add infrastructure solely for hypothetical products.

## Package ownership

### `packages/shared`

Stable cross-platform types, schemas, settings, version identifiers, and serialization contracts. No React, Next.js, browser APIs, databases, generated artifacts, or network access.

### `packages/engine`

Pure game rules:

- guess outcomes;
- scoring and completion policies;
- runner/base advancement for baseball-inning policies;
- search behavior;
- result/share calculations.

It depends only on `shared`.

### `packages/baseball-data`

One canonical player fact system:

- identity, aliases, redirects, and source mappings;
- teams, positions, seasons, career facts, and rate-stat semantics;
- approved Hall of Fame, All-Star, award, and WAR enrichment;
- source provenance, release versioning, QA, and generated runtime artifacts;
- factual inputs usable by gameplay profiles and lineup recipes.

Web code does not calculate, correct, or reinterpret baseball facts.

### `packages/daily`

Portable Daily application logic:

- puzzle numbering and identity;
- gameplay-profile and lineup-recipe contracts;
- deterministic candidate selection;
- recognizability/difficulty policy;
- repeat protection and diversity constraints;
- lineup validation and qualification explanations;
- editorial lifecycle and repository ports;
- public editorial eligibility;
- seven-day orchestration;
- portable Daily transitions.

It does not import React, Next.js, Supabase, clocks, authentication state, or network clients.

### `apps/web`

Next.js/React and web adapters:

- pages and components;
- browser persistence and migration;
- search, hint, guess, result, and admin routes;
- signed-token transport authorization;
- server-only canonical runtime composition;
- HTTP Basic editor boundary;
- Supabase adapters;
- mobile/browser QA and sharing.

It renders and transports domain behavior rather than defining it.

### Supabase/Postgres

Initial relational provider for operational data behind provider-neutral ports:

- editorial puzzle records;
- future gameplay profiles and saved recipes;
- future compact completed-game results.

Supabase does not own baseball facts, recipe semantics, scoring, completion, lifecycle, or answer integrity. The inactive original social/head-to-head schema remains non-authoritative.

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
                        persistence providers
```

Dependencies do not point upward. Rules are centralized once at their owning layer.

## Flexible gameplay architecture

### Stable facts, replaceable interpretation

Native Daily state records stable raw completed-at-bat facts:

- pitch/slot and initials;
- HR/3B/2B/1B/BB/K outcome;
- hints revealed;
- wrong guesses;
- correct, strikeout, or Give Up resolution.

A versioned ruleset interprets those facts.

Current Standard Daily uses `points-v1`: `5/4/3/2/1/0` with all scheduled at-bats. `legacy-inning-v1` preserves compatible pre-ruleset signed/saved sessions and the existing runner advancement plus three-out completion behavior.

The shared game state, pure engine, stateless signed progression, browser persistence, final result, and share contract carry the same ruleset boundary. New scoring weights require a new version rather than reinterpretation of old results.

The points policy may continue recording spoiler-safe outcomes after baseball inning state has reached three outs; the base/runner state is retained for reuse but no longer controls Standard Daily completion.

Do not build a generic plugin platform. Use explicit small versioned policies with focused consumers.

### Hint delivery

The current per-click uncached hint route creates visible latency.

The approved transport boundary is:

- current-at-bat hints are authorized and locally available before the at-bat appears;
- Hint clicks are local state transitions;
- mandatory resolution may deliver the next at-bat bundle;
- answer IDs and reveal data remain server-side until terminal authorization;
- progression tokens/checkpoints preserve the recorded hint depth used for scoring.

The exact serialized bundle is implementation detail. No-visible-wait is the product invariant.

### Completed results

One idempotent completed-game write may contain the natively recorded raw per-at-bat facts, puzzle identity, and ruleset version. Do not persist every hint or guess. Aggregates and percentiles are derived from compact records and compare identical puzzle/ruleset cohorts.

Legacy lines reconstructed for local compatibility are not automatically treated as analytics-quality native facts.

## Canonical player and lineup-content architecture

```text
versioned factual sources
  -> canonical player facts and enrichment
  -> gameplay profiles
  -> versioned lineup recipe
  -> portable candidate generation and validation
  -> editor review/replacement
  -> exact scheduled/published nine-player puzzle
  -> observed solve data
  -> later profile/recipe calibration
```

### Facts versus gameplay judgments

Objective facts remain reproducible baseball-data outputs. Gameplay profiles are editorial/product inputs such as recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual promotion/exclusion, and eventual observed solve rates.

A fact refresh does not overwrite an editorial judgment. An editorial judgment does not mutate a fact.

### Recipes

A recipe contains named/versioned slot groups, factual filters, gameplay-profile filters, repeat policy, reveal readiness, and optional diversity constraints.

“Standard Daily” is one recipe. Future 2000s, team, All-Star, WAR-threshold, expert, or user-selected games reuse the same contract only when product scope approves them.

`packages/daily` owns recipe evaluation. Supabase may persist recipe/profile records through adapters. React provides a builder and review UI but does not interpret the recipe independently.

### Exact puzzle identity

The recipe creates a proposal. The scheduled/published puzzle stores the exact ordered nine canonical IDs. Recipe or profile changes affect later proposals and do not alter an already finalized date.

## Runtime serving and answer protection

- Initial browser state contains public puzzle metadata, initials, and opaque authorization state.
- New signed progression includes `points-v1`; pre-ruleset valid tokens normalize to `legacy-inning-v1`.
- Search is lightweight and spoiler-safe.
- Full reveal shards load only after terminal resolution.
- Current-at-bat hints may be preauthorized locally; unrelated future answers/reveals remain unavailable.
- Legacy IDs resolve through canonical redirects.
- Service-role credentials remain server-only.
- Replay of an earlier valid anonymous token is an accepted launch limitation.
- No Redis, replay cache, per-action database write, or durable anonymous server session is introduced.

## Editorial persistence

`daily_editorial_puzzles` remains the current authoritative operational table for editorial dates:

- one row per date;
- exact nine selections stored atomically;
- draft/scheduled/published/archived lifecycle;
- optimistic revisions and audit metadata;
- RLS with server service-role access;
- no duplicate player facts.

Gameplay profiles, recipes, and completed results require separate migrations and provider-neutral contracts before persistence.

## Scale target

At 10,000+ plays per day:

- serve immutable player artifacts with cache-friendly delivery;
- keep anonymous visible game state client-side;
- perform stateless progression verification;
- read at most the date’s editorial record during actions;
- avoid per-hint database writes;
- submit at most one compact completed result;
- keep routes thin and credentials isolated.

Vercel and Supabase are replaceable adapters.

## Documentation and agent continuity

`AGENTS.md` is a map and operating contract, not the sole encyclopedia. Structured canonical docs contain product, architecture, data, and execution truth.

Controls:

- PRs use an explicit Documentation impact section.
- CI checks material diffs for canonical-doc updates or a specific exception.
- Hosted operational changes require a handoff update before the next product PR.
- Large changes begin with a plan and one bounded scope contract.
- Periodic documentation gardening compares code, issues, deployment, and docs.
- Codex review supplements, not replaces, human product judgment and final verification.

## Current sequence

1. Verify the merged `points-v1` production deployment, all-nine gameplay, refresh behavior, and midnight-Pacific rollover.
2. Complete the authenticated hosted editorial/public-runtime checklist.
3. Add immediate active-at-bat hints.
4. Add compact completed-result persistence and percentile comparison.
5. Add gameplay-profile and recipe contracts plus a conservative Standard Daily recipe.
6. Continue launch hardening and heritage presentation.

## Explicit non-goals

- Rewriting the application.
- Moving factual baseball ownership into Supabase or React.
- Building every possible themed mode now.
- A generic plugin framework for rules or recipes.
- Tamper-proof anonymous competition.
- Microservices, queues, replay caches, or per-action persistence.
- Accounts before the core Daily loop is excellent.

## Decision rule

Architecture is sufficient when scoring weights, completion behavior, hint transport, player profiles, and lineup recipes can evolve without duplicating rules, corrupting historical facts, or rewriting unrelated UI and persistence. When a decision changes, code, tests, `docs/START-HERE.md`, `tasks/todo.md`, and the affected canonical document change together.
