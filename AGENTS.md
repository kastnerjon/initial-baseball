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

## Working protocol

1. Read the canonical blueprint and only the relevant architecture/spec files.
2. Identify the owning layer and dependency direction.
3. Write a brief implementation plan.
4. Implement behavior and tests together.
5. Verify package boundaries and search for duplicate logic.
6. Run repository checks.
7. Update canonical documentation and lessons when applicable.
8. Do not mark complete until code, tests, PR description, and docs agree.
