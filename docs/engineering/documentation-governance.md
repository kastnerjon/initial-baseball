# Documentation governance

Status: Active engineering rule
Last updated: 2026-07-21

## Purpose

Project documentation describes the current product, architecture, roadmap, and durable handoff state. It is not a frozen historical specification and must not become a second contradictory version of the codebase.

## Canonical documents

- `docs/START-HERE.md`: concise resumption state, approved deferred decisions, genuinely open decisions, operational blockers, and new-conversation protocol
- `docs/product/daily-inning-blueprint.md`: product behavior, scope, lifecycle, launch requirements, and deferred work
- `docs/architecture-and-scale-plan.md`: package ownership, system boundaries, scale assumptions, administration architecture, and current implementation sequence
- `docs/spec/data-model.md`: persisted entities, fields, relationships, and data-retention rules
- `docs/spec/engine.md`: baseball outcomes and runner/inning rules
- `docs/spec/api.md`: external and internal API contracts
- `tasks/todo.md`: current ordered implementation work only
- `tasks/lessons.md`: durable corrections and mistakes that should not recur

Supporting documents may add detail but must not override these sources.

## Handoff document contract

`docs/START-HERE.md` exists so a new conversation can resume without copying a long chat transcript.

It must distinguish:

1. **Current verified facts** — what is merged, live, blocked, or actively next.
2. **Approved but not yet implemented decisions** — settled product intentions that may be many pull requests away and must not be dropped.
3. **Open decisions** — questions that remain genuinely unresolved.

Do not place routine pull-request history in the handoff. Link to canonical documents and issues instead. Update the handoff whenever current work order, deployment state, approved deferred behavior, open decisions, or the standard resume prompt changes.

A new conversation should read `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md`, verify current GitHub state, and continue the exact next bounded item. It should not restart settled architecture discussions merely because conversational context changed.

## Change classification

### Documentation required

Update the relevant canonical documents in the same pull request when a change affects:

- product scope or user flow;
- game rules or scoring;
- package ownership or architectural boundaries;
- database tables, stored events, or retention;
- API contracts;
- puzzle generation, publication, or administration;
- answer integrity, security, privacy, or authentication;
- launch requirements or roadmap priority;
- supported player data or stat definitions;
- an approved deferred decision recorded in `docs/START-HERE.md`;
- operational state material to resuming work.

### Documentation usually not required

A documentation update is normally unnecessary for:

- isolated visual spacing or typography changes;
- a bug fix that restores already documented behavior;
- test-only refactoring;
- internal renaming that does not alter ownership or contracts.

If a supposedly minor change reveals inaccurate documentation, correct the documentation.

## Pull request completion rule

A material change is not complete until:

1. Code and tests implement the decision.
2. Relevant canonical documentation reflects the resulting state.
3. Obsolete statements are removed rather than left beside the new rule.
4. `tasks/todo.md` reflects what remains, not completed work.
5. `docs/START-HERE.md` is updated when the handoff state or a durable future decision changed.
6. The pull request explains any intentional documentation exception.

## Contradictory decisions

A later decision may replace an earlier one. When that happens:

- update the current-state document directly;
- preserve rationale in the pull request or an architecture decision record when useful;
- add compatibility or migration notes when stored data or public contracts are affected;
- do not preserve obsolete rules merely because they were previously documented.

The product may evolve. Documentation drift is not acceptable.

## Decision records

Use an architecture decision record only for choices whose rationale remains useful after implementation changes, such as database strategy, client/server authority, data-source policy, and package boundaries.

A decision record should contain:

- decision;
- context;
- alternatives considered;
- consequences;
- replacement status if superseded.

Decision records explain why. Canonical specifications describe what is currently true. Approved deferred product details belong in `docs/START-HERE.md` until their implementation makes them part of a deeper canonical contract.

## Review checklist

Every material pull request should answer:

- Which canonical documents are affected?
- Does code still match documented product and game rules?
- Did completed work remain incorrectly listed as future work?
- Did a new dependency cross an ownership boundary?
- Does persisted or generated data require migration or regeneration notes?
- Did the pull request settle or change an open decision?
- Could a future contributor read the docs and implement obsolete behavior?
- Could a new conversation resume from `docs/START-HERE.md` without relying on chat history?

## Maintenance sweep

Before a public launch or major milestone, compare:

- product copy and actual UI;
- engine rules and tests;
- generated data fields and specifications;
- routes and API documentation;
- database migrations and data-model documentation;
- completed pull requests and the active task list;
- `docs/START-HERE.md` against current GitHub, deployment, and roadmap state.

Correct drift directly; do not delay valid product work merely to preserve prior wording.