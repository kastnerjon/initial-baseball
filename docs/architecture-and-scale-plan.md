# Architecture and launch-scale plan

Status: Living source of truth
Last updated: 2026-07-18

## Product goal

Initial Baseball should first become a polished, fast Daily game that is easy to send to friends and enjoyable enough to share. Daily Inning is the only committed product.

A future head-to-head game remains a possibility, not an active product requirement. The near-term architecture target is not maximum abstraction. It is a codebase that supports fast product iteration, stable Daily gameplay, and at least 10,000 plays per day without requiring a rewrite.

The end-to-end product behavior is defined in `docs/product/daily-inning-blueprint.md`. Documentation maintenance rules are defined in `docs/engineering/documentation-governance.md`.

## Operating principles

Every change should be evaluated on two levels:

1. Does it improve the product behavior or user experience?
2. Does it preserve clear ownership, portability, testability, and maintainability across the codebase?

Architecture work must remain behavior-preserving unless a PR explicitly changes product behavior. Large rewrites and speculative infrastructure are out of scope.

## Current package ownership

### `packages/shared`

Owns stable cross-platform types, schemas, settings, and serialization contracts. It must not depend on React, Next.js, browser APIs, Supabase, or generated baseball data.

### `packages/engine`

Owns pure baseball rules and broadly reusable game behavior: guess evaluation, outcomes, runner advancement, inning state, search algorithms, and share-result calculations. It depends only on `shared`.

### `packages/baseball-data`

Owns committed source data, generation scripts, generated player artifacts, recognizability inputs, career statistics, and season statistics. Web clients may consume its outputs, but must not generate or mutate them.

### `packages/daily` (planned)

Will own Daily-specific application logic: puzzle numbering, deterministic lineup selection, recognizability ranking, editorial override validation, puzzle construction, and the portable Daily session reducer. It may depend on `shared`, `engine`, and `baseball-data`.

### `apps/web`

Owns Next.js pages, React components, HTTP routes, browser persistence, web sharing, and web-specific infrastructure adapters. It should render and transport domain behavior rather than define it.

### `apps/mobile`

Remains an inactive scaffold. No native product work is planned. Shared logic should remain platform-neutral where doing so is inexpensive and natural, but current work must not be designed around a hypothetical mobile client.

## Scale target: 10,000+ plays per day

Ten thousand Daily players is a modest systems load if the game remains mostly static and client-driven. The architecture should exploit that.

### Keep the hot path cheap

- Render the Daily puzzle from deterministic or persisted data.
- Serve immutable player and season data with CDN-friendly caching.
- Keep gameplay state in the client for anonymous players.
- Avoid a database write for every hint reveal, incorrect guess, or base-state transition.
- Submit at most one compact, idempotent result per completed game when aggregate statistics are introduced.

### Avoid unnecessary infrastructure

The initial launch does not require microservices, queues, a dedicated mobile backend, real-time subscriptions, or server-side game sessions. Vercel plus a small relational database can support the expected traffic if routes remain thin and cacheable.

### Preserve concrete seams

Before adding admin, publication, aggregate results, or accounts, define repository interfaces so the persistence provider remains an adapter rather than becoming embedded in React components and game rules.

Do not create abstractions solely for an imagined future mode. Extract a shared boundary when Daily already needs it or when a second concrete consumer exists.

## Stabilization sequence

### PR 1: recognizability correctness and guardrails

- Replace the dense recognizability comparator with explicit deterministic comparisons.
- Add focused ranking tests, including equal scores, nullable years, names, and IDs.
- Preserve the current lineup pools and visible behavior unless tests prove the current comparator is incorrect.

### PR 2: extract Daily puzzle construction

- Create `packages/daily`.
- Move puzzle numbering, recognizability ranking, deterministic selection, and override validation from `apps/web`.
- Keep the web API and visible Daily output unchanged.
- Add package-boundary tests and a small import smoke test.

### PR 3: normalize generated-data ownership

- Move season-stat generation and output fully under `packages/baseball-data`.
- Remove duplicated generation from the web `prebuild` and baseball-data build lifecycle.
- Add explicit `generate` and `verify-generated` commands.
- Make the web season route a thin cached adapter over a baseball-data accessor.

### PR 4: extract the Daily session reducer

- Replace the cluster of React state variables with one portable state object and pure reducer.
- Preserve local-storage compatibility through a schema migration.
- Keep React responsible for rendering and dispatching user actions only.

### PR 5: reduce client payload and protect answers

- Generate a lightweight player-search document.
- Stop serializing full career and reveal data for the entire player universe to the browser.
- Continue including complete reveal data only when it cannot leak hidden answers.
- Add explicit tests for answer leakage through initial payloads and routes.

### PR 6: prepare admin and publication

- Define draft, scheduled, published, and archived puzzle states.
- Add a `DailyPuzzleRepository` interface.
- Keep deterministic generation as the default draft creator and fallback.
- Implement the chosen database only behind repository adapters.

### PR 7: aggregate completed-game results

- Define one compact, idempotent completed-game result payload.
- Store enough raw outcome data to recalculate aggregate statistics.
- Add field-comparison queries without persisting every interaction.

### PR 8: launch instrumentation and hardening

- Add analytics and error monitoring.
- Measure initial payload size and interaction latency.
- Verify caching, mobile behavior, refresh recovery, and canonical deployment.
- Add privacy and basic legal pages.

## Launch-readiness requirements

Before broad friend distribution:

- Daily puzzle and historical overrides are deterministic and regression-tested.
- Tomorrow's lineup is editorially reviewable before publication.
- The full mobile web game is polished at common iPhone viewport sizes.
- Initial page payload and interaction latency are measured.
- Static and immutable responses use caching.
- Share output is reliable and spoiler-safe.
- Errors do not erase local progress.
- Search handles aliases, accents, ordered tokens, and same-name cases.
- Hidden answers are not exposed before reveal.
- One deployment is canonical and observable.
- The app can handle repeated requests without per-play server state.

## Explicit non-goals for this phase

- Rewriting the engine or application from scratch.
- Building a native mobile application.
- Building head-to-head gameplay.
- Introducing microservices or queues.
- Persisting every anonymous gameplay action.
- Adding accounts before the anonymous Daily loop is excellent.
- Creating abstractions without a concrete upcoming consumer.

## Decision rule

Architecture cleanup is complete enough when the product team can rapidly improve the visible Daily experience without placing new game rules, data generation, puzzle lifecycle logic, or persistence logic directly inside React components or Next.js routes.

When a decision changes, the implementation and affected canonical documents must be updated in the same pull request.