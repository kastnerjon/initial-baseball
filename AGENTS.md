# Initial Baseball — Agent Operating Manual

Read this before touching code. This repository is maintained primarily through AI-assisted development, so architectural discipline must be explicit rather than assumed.

## Current product

Initial Baseball is currently one committed product: **Daily Inning**, a browser-first daily baseball guessing game.

A future native client or head-to-head mode is possible, but neither is a committed roadmap item. Preserve inexpensive portability seams; do not add infrastructure or abstractions solely for hypothetical products.

Canonical product intent: `docs/product/daily-inning-blueprint.md`.
Canonical architecture: `docs/architecture-and-scale-plan.md`.
Documentation rules: `docs/engineering/documentation-governance.md`.
Player identity and data quality: `docs/spec/player-data-quality.md`.

## Package ownership

### `packages/shared`

Stable cross-platform types, schemas, settings, and serialization contracts. No React, Next.js, browser APIs, Supabase, or generated baseball data.

### `packages/engine`

Pure baseball/game rules: guess evaluation, outcomes, runner advancement, inning state, search behavior, and share/result calculations. Depends only on `shared`.

### `packages/baseball-data`

Source data, player identity resolution, aliases, normalization, corrections, generation scripts, recognizability inputs, career stats, season stats, and data-quality reports.

### `packages/daily`

Daily puzzle numbering, lineup generation, recognizability ranking, override validation, puzzle construction, and portable Daily session transitions. May depend on `shared`, `engine`, and `baseball-data`.

### `apps/web`

Next.js routes, React components, web rendering, browser persistence, sharing, and web-specific infrastructure adapters. It should transport and render domain behavior, not define it.

### Database/repository adapters

Publication lifecycle, admin persistence, completed-game results, and eventual accounts. Database clients must stay behind explicit repository/service boundaries.

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

Dependencies must not point upward. In particular:

- React and Next.js must not be imported by domain packages.
- Database clients must not be imported by `engine` or pure Daily logic.
- UI components must not own baseball rules, player normalization, or puzzle generation.
- Data generation must not be owned by `apps/web`.

## Mandatory architecture check before implementation

Before changing code, answer:

1. Which layer owns this behavior?
2. Does an implementation already exist elsewhere?
3. What may this code depend on?
4. What must not depend on it?
5. Is the behavior pure and portable, or platform-specific?
6. Does this change alter a product rule, data contract, persistence model, or package boundary?
7. Which canonical document must change with it, if any?

Do not begin implementation until ownership is clear. When ownership is genuinely ambiguous, choose the narrowest existing layer that owns the behavior; do not create a new abstraction merely to avoid deciding.

## Mandatory PR scope contract

Before implementation, write a short scope contract containing:

- **Goal:** one observable outcome.
- **Owning layer:** one primary package or application layer.
- **In scope:** the exact behavior and files expected to change.
- **Out of scope:** nearby findings and roadmap work that will not be included.
- **Acceptance checks:** focused tests plus the final repository checks.
- **Stop conditions:** any event that requires pausing and opening a separate decision or follow-up.

A pull request should normally represent one owning concern and one architectural decision. Multiple files are allowed when they implement that single concern, but unrelated review findings must not be collected into one hardening PR.

Default decomposition triggers:

- more than one primary owning layer;
- a new external dependency, database, cache, queue, service, or hosting-specific primitive;
- a change to client/server authority, persistence, publication, authentication, or the product threat model;
- a canonical-document change that alters the original task rather than recording it;
- more than 12 handwritten source/test files or roughly 600 net handwritten lines;
- a review finding whose fix would increase the PR's intended scope by roughly 25% or more.

When any trigger occurs, stop before implementing the expanded work. Record the finding in an issue or follow-up PR and obtain an explicit architecture decision when required. Do not rewrite canonical documents merely to rationalize an implementation that crossed the original scope.

Generated snapshots, migrations, and mechanical outputs may exceed file-count thresholds when they serve one explicitly reviewed concern. The PR must distinguish generated from handwritten changes.

## Review and execution limits

- Branch from the latest `main`, never from another agent/Codex feature branch unless the PR is explicitly stacked.
- Develop and test a coherent change before pushing. Do not use remote commits as an interactive editor.
- Run focused tests while developing. Run the full expensive data pipeline and production build once near completion, then again only when a relevant code change invalidates that result.
- Use one bounded automated-review pass after the intended implementation is complete.
- Fix in-scope correctness or safety findings in the current PR. Move materially new architecture or unrelated findings to a follow-up issue/PR.
- A reviewer is not an open-ended source of new scope. Do not repeatedly request full reviews until no conceivable finding remains.
- Never merge merely because checks are green, but do not keep a correct PR open to pursue optional unrelated hardening.
- If a bug fix starts changing product scope, infrastructure, persistence, or client/server authority, stop and make that decision separately before continuing.

## Non-negotiable guardrails

1. No new baseball or scoring rule directly inside a React component or route.
2. No player-data correction, alias, merge, or display-name patch inside UI code.
3. No Supabase, database, network, storage, date reads, or platform APIs inside `packages/engine`.
4. No database calls inside pure Daily puzzle/session logic.
5. No duplicate implementation of the same rule across web and packages.
6. No large component that combines rendering, game transitions, persistence, search, scoring, and network access.
7. No generic dumping-ground files such as `utils.ts`, `helpers.ts`, or `misc.ts`.
8. No new package, repository interface, or abstraction without a concrete upcoming consumer.
9. No hidden-answer leakage through HTML, serialized props, initial payloads, APIs, logs, or share output.
10. No direct generated-artifact edits when the correct fix belongs in source data, normalization, or auditable corrections.
11. Published Daily puzzles are immutable; changes require an explicit new version or editorial action.
12. Tests live with the layer that owns the behavior.
13. No bug-fix PR may silently introduce a new architecture and then edit the canonical plan to justify it.
14. No pull request may combine separate review findings solely because they were discovered in the same review.

## File and component discipline

- Target fewer than 300 lines per source file.
- Any file above 500 lines requires explicit justification and a decomposition review.
- React components should primarily render state and dispatch actions.
- Route handlers should validate, authorize, call a service/repository, and format a response.
- Pure transformations should be exported and tested independently.
- Prefer explicit domain names over vague reusable names.

## Required PR architecture section

Every substantial PR must state:

- **Owning layer:** where the behavior belongs.
- **Dependency impact:** new or changed dependencies and why they are allowed.
- **Boundary check:** confirmation that rules, data normalization, persistence, and UI remain separated.
- **Duplication check:** whether similar logic exists elsewhere.
- **Documentation impact:** files updated, or why no canonical document changed.
- **Portability impact:** whether portable logic remains free of web/database dependencies.
- **Scope check:** the original goal, explicit exclusions, and whether any decomposition trigger was crossed.
- **Review disposition:** which findings were fixed here and which were moved to follow-up work.

“Architecture impact: none” is acceptable only with a brief explanation.

## Definition of done

A change is complete only when:

1. Behavior and ownership are clear.
2. Focused tests cover the behavior at the owning layer.
3. Build, tests, typecheck, lint, and file-size checks pass as applicable.
4. User-facing changes are checked on common mobile web sizes.
5. Answer leakage and spoiler-safe sharing remain protected.
6. No prohibited dependency direction or duplicated rule was introduced.
7. Relevant canonical documentation is updated in the same PR.
8. The PR description contains the architecture section above.
9. The final diff still matches the pre-implementation scope contract.
10. New findings outside that contract are recorded separately rather than silently absorbed.

## Working protocol

1. Start from the latest `main` and verify the target branch and PR base.
2. Read the canonical blueprint and only the relevant architecture/spec files.
3. Write the scope contract and identify decomposition triggers before changing code.
4. Identify the owning layer and dependency direction.
5. Implement behavior and focused tests together as one coherent local change.
6. Verify package boundaries and search for duplicate logic.
7. Run targeted checks, inspect the final diff against the scope contract, then run repository checks once.
8. Update canonical documentation only when the approved decision actually changed.
9. Request one bounded review, resolve in-scope findings, and file materially new findings separately.
10. Do not mark complete until code, tests, PR description, docs, and the original scope agree.