# Architecture and launch-scale plan

Status: Living architecture source of truth  
Last updated: 2026-08-16

## Product goal

Build a polished Daily baseball guessing game that supports at least 10,000 plays per day without a rewrite. Daily Inning is the only committed product; inexpensive reuse seams may later support themed or alternate experiences.

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Lineup content: `docs/product/lineup-content-system.md`.  
Current handoff: `docs/START-HERE.md`.

## Operating principles

- Repository-local versioned knowledge is the system of record.
- Stable facts/contracts remain durable; scoring, difficulty, and presentation may be tuned through versions.
- Ownership and dependency direction are explicit and tested.
- Each PR has one bounded concern, focused tests, full CI, review, deployment verification, and documentation reconciliation.
- Do not add speculative infrastructure.

## Ownership

### `packages/shared`
Stable portable types, schemas, settings, ruleset identifiers, and serialization contracts.

### `packages/engine`
Pure outcomes, versioned scoring/completion, runner advancement, search behavior, and result/share calculations. Depends only on shared.

### `packages/baseball-data`
Canonical identity, aliases, teams, seasons, career facts, enrichment, provenance, QA, generated runtime artifacts, canonical-ID format validation, and deterministic reveal-shard access. Web code does not reinterpret facts.

### `packages/daily`
Puzzle identity/numbering, future gameplay profiles and lineup recipes, selection, recognizability/difficulty policy, repeat/diversity constraints, validation, editorial lifecycle, repository ports, public eligibility, and seven-day orchestration.

### `apps/web`
Next.js/React rendering, browser persistence, search/hint/resolve/admin routes, signed-token authorization, current-batter hint bundles, server-only canonical runtime composition, sharing, HTTP Basic editor boundary, and Supabase adapters.

### Supabase/Postgres
Operational persistence behind provider-neutral ports: current editorial puzzles and future profiles, recipes, and compact completed results. It does not own baseball facts, scoring, recipe semantics, or lifecycle rules.

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

Dependencies do not point upward. React and routes transport/render domain behavior rather than define it.

## Versioned gameplay

Native completed-at-bat facts preserve slot, initials, HR/3B/2B/1B/BB/K, hints revealed, wrong guesses, and correct/strikeout/Give Up resolution.

- `points-v2`: current Standard Daily policy, `4/3/2/1/0.5/0`, all scheduled at-bats, maximum 36 for nine.
- `points-v1`: compatibility policy, `5/4/3/2/1/0`, all scheduled at-bats, maximum 45 for nine.
- `legacy-inning-v1`: runner advancement and three-out completion for compatible pre-ruleset sessions.

Ruleset version flows through shared state, engine, signed progression, local persistence, final result, and share output. Point totals and resolved-result copy are derived from the engine policy rather than duplicated in React. Do not build a generic plugin framework.

## Immediate active-at-bat hint architecture

The former per-click `/api/daily/hint` client path caused visible latency. The active design is:

```text
verified current progression
  -> server joins only current pitch hints
  -> browser receives four-hint active bundle
  -> local Hint click selects next value + signed checkpoint
  -> guess/Give Up resolution verifies checkpoint
  -> response supplies refreshed same-pitch or next-pitch bundle
```

### Bundle contract

A bundle contains:

- current pitch number;
- already revealed depth;
- all four current-batter hint labels/values;
- signed checkpoints only for later reveal depths still available.

It contains no answer ID/name, reveal record, credentials, or future-batter hints.

### Delivery paths

- Bootstrap includes batter one’s bundle.
- Incorrect resolution returns the same pitch’s bundle with updated strike claims.
- Correct/K/Give Up returns the next pitch’s bundle unless complete.
- `/api/daily/hints` hydrates only the bundle authorized by a compatible saved token.
- The legacy one-hint route remains server-compatible but is absent from active client chunks.

### Integrity consequences

The browser can inspect all current-batter hints and still holds the current signed token. That is accepted under the anonymous noncompetitive threat model. The architecture prevents accidental answer/future-pitch leakage, not adversarial score claims. Stronger incentives require server-authoritative attempts.

No browser encryption, all-nine hint preload, Redis, replay cache, durable anonymous session, or per-Hint database write is introduced.

## Canonical player and lineup-content architecture

```text
versioned factual sources
  -> canonical player facts/enrichment
  -> separate gameplay profiles
  -> versioned lineup recipe
  -> portable candidate generation/validation
  -> editor review/replacement
  -> exact scheduled/published nine
  -> observed solve data
  -> later calibration
```

Facts and editorial judgments remain separate. Standard Daily is one recipe, not the only selector. A finalized puzzle stores exact ordered canonical IDs; later profile/recipe changes do not alter it.

## Runtime and answer protection

- Public puzzle metadata/initials and the active batter’s hints may reach the browser.
- Answer IDs/names and canonical reveal data remain server-side until terminal resolution.
- Unrelated future-batter hints remain server-side.
- Signed claims control puzzle, ruleset, pitch, reveal depth, strikes, outs, and completion.
- Search is spoiler-safe and initializes its full candidate set only on the search path.
- Ordinary canonical-format guesses compare directly with the server-only canonical answer ID and do not require full-universe identity initialization.
- Legacy/noncanonical submitted IDs cross the canonical redirect boundary only when used.
- Terminal reveal reads the deterministic answer shard directly; full canonical search/index state is not required solely to locate a reveal.
- Service-role credentials remain server-only.
- Replay is an accepted anonymous limitation.

### Public Daily resolution performance

The public web runtime caches the fully materialized server-only `DailyPuzzle` by puzzle date in Next's Data Cache. Materialization includes the authoritative editorial/fallback selection, exact canonical IDs, hints, and puzzle metadata needed by signed resolution. The cache has a 300-second safety revalidation window and is invalidated after every successful write through the authenticated web admin repository.

This final-puzzle cache replaces the narrower row-only cache. On a cache hit, `/api/daily/resolve` does not need to query Supabase, rebuild the nine-player puzzle, rank the Daily candidate universe, or initialize the public lineup source. The heavyweight Daily lineup/public-source and Supabase modules are loaded only when a materialized-puzzle cache miss requires reconstruction.

Search-candidate construction is separated from the resolve composition. The full canonical player index remains available for search and legacy-ID resolution, but it is not loaded merely to process a normal canonical-format guess. Terminal reveal uses deterministic shard addressing from the canonical player ID so a correct guess, third strike, or Give Up can load only the needed reveal shard.

`POST /api/daily/resolve` retains its `daily-resolve` `Server-Timing` duration. Because that metric begins inside the route handler, comparing it with real-browser end-to-end latency helps identify any remaining browser/network/platform-startup component after the hot path is reduced; it contains no answer data.

These are web/server runtime optimizations only. They do not change scoring, lifecycle rules, progression claims, publication authority, or public payloads. Supabase remains authoritative for editorial records. A syntactically valid but nonexistent canonical submitted ID is treated as an incorrect anonymous guess rather than forcing a full player-index validation; legacy/noncanonical IDs remain explicitly validated. Out-of-band database edits that bypass the authenticated admin path may remain cached until the safety revalidation window expires.

## Editorial persistence

`daily_editorial_puzzles` remains authoritative for editorial dates: one row/date, atomic exact-nine JSONB selection, lifecycle status, optimistic revision, audit metadata, RLS, and server-only service role. Future profiles/recipes/results require separate portable contracts and migrations.

## Scale target

At 10,000+ plays/day:

- serve immutable baseball artifacts cacheably;
- cache the fully materialized authoritative public puzzle instead of rebuilding it on every resolution;
- keep heavyweight lineup/search initialization off unrelated request paths;
- use deterministic reveal shards so terminal resolution reads only the answer shard;
- keep visible anonymous state client-side;
- verify stateless progression;
- perform no database write per hint/guess;
- hydrate at most one active hint bundle on saved refresh;
- submit at most one compact completed result;
- keep routes thin and credentials isolated.

Vercel and Supabase remain replaceable adapters. No new cache service, queue, database, or hosting-specific compute mode is required for the current optimization.

## Continuity controls

- `AGENTS.md` is a map; structured docs own deeper truth.
- PRs include Documentation impact.
- CI requires canonical-doc updates or a specific exception for material diffs.
- Hosted work is incomplete until START-HERE/todo are reconciled.
- Repeated review findings become tests/scripts/rules.

## Current sequence

1. Re-test resolution latency on production mobile after the hot-path optimization, then complete `points-v2`, restored-session hydration, all-nine, and authenticated admin behavior verification.
2. Add compact completed-result persistence and same-puzzle/same-ruleset percentile comparison.
3. Add gameplay-profile and recipe contracts plus a conservative recognizable Standard Daily recipe.
4. Continue analytics, monitoring, mobile polish, legal/domain basics, and heritage presentation.

## Non-goals

Rewriting the app; moving facts into Supabase/React; building all themed modes; generic rules plugins; tamper-proof anonymous competition; microservices/queues/replay caches; accounts before the Daily loop is excellent.

## Decision rule

Architecture is sufficient when scoring, completion, hint transport, player profiles, and lineup recipes can evolve without duplicating rules, corrupting facts/history, or rewriting unrelated UI/persistence. Code, tests, handoff, todo, and canonical docs change together.
