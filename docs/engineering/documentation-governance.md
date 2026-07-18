# Documentation governance

Status: Active engineering rule
Last updated: 2026-07-18

## Purpose

Project documentation describes the current product and architecture. It is not a frozen historical specification and it must not become a second, contradictory version of the codebase.

## Canonical documents

- `docs/product/daily-inning-blueprint.md`: product behavior, scope, lifecycle, launch requirements, and deferred work
- `docs/architecture-and-scale-plan.md`: package ownership, system boundaries, scale assumptions, and stabilization sequence
- `docs/spec/data-model.md`: persisted entities, fields, relationships, and data retention rules
- `docs/spec/engine.md`: baseball outcomes and runner/inning rules
- `docs/spec/api.md`: external and internal API contracts
- `tasks/todo.md`: current ordered implementation work only
- `tasks/lessons.md`: durable corrections and mistakes that should not recur

Supporting documents may add detail, but they must not override these sources.

## Change classification

### Documentation required

Update the relevant canonical document in the same pull request when a change affects any of the following:

- product scope or user flow
- game rules or scoring
- package ownership or architectural boundaries
- database tables, stored events, or retention
- API contracts
- puzzle generation, publication, or administration
- answer integrity, security, privacy, or authentication
- launch requirements or roadmap priority
- supported player data or stat definitions

### Documentation usually not required

A documentation update is normally unnecessary for:

- isolated visual spacing or typography changes
- a bug fix that restores already documented behavior
- test-only refactoring
- internal renaming that does not alter ownership or contracts

If a supposedly minor change reveals that the documentation is inaccurate, correct the documentation.

## Pull request completion rule

A material change is not complete until:

1. Code and tests implement the decision.
2. Relevant canonical documentation reflects the resulting state.
3. Obsolete statements are removed rather than left beside the new rule.
4. `tasks/todo.md` reflects what remains, not work already completed.
5. The pull request explains any intentional documentation exception.

## Contradictory decisions

A later decision may replace an earlier one. When that happens:

- update the current-state document directly
- preserve rationale in the pull request or an architecture decision record when useful
- add compatibility or migration notes when stored data or public contracts are affected
- do not preserve obsolete rules merely because they were previously documented

The product is allowed to evolve. Documentation drift is not.

## Decision records

Use an architecture decision record only for choices whose rationale will remain useful after the current implementation changes. Examples include database strategy, client/server authority, data-source policy, and package boundaries.

A decision record should contain:

- decision
- context
- alternatives considered
- consequences
- replacement status if superseded

Decision records explain why. Canonical specifications still describe what is currently true.

## Review checklist

Every material pull request should answer:

- Which canonical documents are affected?
- Does the code still match the documented game rules?
- Did a completed task remain incorrectly listed as future work?
- Did a new architectural dependency cross an ownership boundary?
- Does persisted or generated data require a migration or regeneration note?
- Could a future contributor read the docs and implement the old behavior by mistake?

## Maintenance sweep

Before a public launch or major milestone, perform a documentation sweep that compares:

- product copy and actual UI
- engine rules and tests
- generated data fields and data specifications
- routes and API documentation
- database migrations and data model documentation
- completed pull requests and the active task list

The sweep should correct the documents; it should not delay valid product changes merely to preserve prior wording.