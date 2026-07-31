# Documentation governance

Status: Active engineering rule  
Last updated: 2026-07-31

## Purpose

Repository-local, versioned documentation is the system of record for product intent, architecture, operational state, and resumption context. Chat history, deployment dashboards, and human memory are inputs to documentation—not substitutes for it.

A new conversation or Codex task must be able to resume accurately from the repository.

## Canonical documents

- `AGENTS.md`: short operating map, ownership constraints, PR protocol, and required checks.
- `docs/START-HERE.md`: verified current state, approved deferred decisions, open decisions, blockers, and exact next work.
- `docs/product/daily-inning-blueprint.md`: product behavior and launch requirements.
- `docs/product/lineup-content-system.md`: recognizability, gameplay profiles, recipes, and content workflow.
- `docs/architecture-and-scale-plan.md`: package ownership, dependency direction, scale, and implementation sequence.
- `docs/spec/data-model.md`: persisted entities, fields, and retention.
- `docs/spec/engine.md`: implemented game-rule contracts.
- `docs/spec/api.md`: route and transport contracts.
- `tasks/todo.md`: active ordered work only.
- `tasks/lessons.md`: durable mistakes and corrections.

Supporting documents add detail but do not override these sources.

## Handoff contract

`docs/START-HERE.md` must distinguish:

1. **Verified current facts** — merged code, live deployment, configured infrastructure, incomplete verification, and active blockers.
2. **Approved but not yet implemented decisions** — durable product/architecture directions that future sessions must preserve.
3. **Open decisions** — questions that genuinely remain unsettled.

Do not paste chat transcripts into the handoff. Translate discussion into precise decisions, implementation status, and ownership.

## Why drift occurred in July 2026

The repository already required documentation updates, but the rule was primarily procedural.

PR #120 merged, hosted secrets and the Supabase migration were configured, production was deployed, and PR #121 fixed authentication. Those operational facts occurred after the previous canonical-doc update. No final reconciliation PR updated `docs/START-HERE.md` or `tasks/todo.md`, and CI had no semantic documentation-impact check.

The lesson is that a written expectation without a merge gate or post-deployment completion step is not sufficient.

## Required PR documentation section

Every pull request must contain a `## Documentation impact` section that states:

- product documents changed;
- architecture/data/API documents changed;
- handoff/todo changes;
- operational state checked;
- or a specific reason no canonical document is required.

“None,” “N/A,” or “no impact” without explanation is not a valid exception for a material change.

## Mechanical documentation-impact gate

CI runs `scripts/check-docs-impact.mjs` on pull requests.

The gate:

- requires the `## Documentation impact` section;
- identifies material product, domain, web-runtime, migration, and workflow changes;
- requires at least one canonical document to change for material diffs;
- permits a specific `Documentation exception: ...` line when a change truly restores already documented behavior;
- requires `docs/START-HERE.md` or `tasks/todo.md` for operationally sensitive workflow/migration/deployment changes unless the exception explains why current state is unaffected.

The gate cannot prove semantic accuracy. It forces an explicit reviewable decision and prevents documentation from being silently omitted.

The documentation-impact check should be configured as a required status check for `main`. Until repository rules are verified, do not merge a PR with this check missing or failing.

## Operational completion rule

External operational work can change reality without changing a source file. Therefore:

- configuring secrets;
- applying a hosted migration;
- changing a domain;
- deploying or rolling back;
- completing production QA;
- discovering a production blocker;

is not considered complete until a focused PR updates `docs/START-HERE.md` and `tasks/todo.md`.

Before starting the next product PR after operational work, verify the handoff against GitHub, Vercel, Supabase, and relevant issues.

## Change classification

Update canonical docs in the same PR when a change affects:

- product scope or user flow;
- game rules, scoring, completion, or hints;
- player-data definitions or source policy;
- lineup generation, recipes, recognizability, publication, or administration;
- package ownership or dependency boundaries;
- database tables, stored records, or retention;
- API/transport contracts;
- answer integrity, security, authentication, or privacy;
- launch requirements or roadmap order;
- deployment/configuration facts needed to resume work.

Documentation is usually unnecessary for an isolated style adjustment, test-only refactor, or bug fix that exactly restores already documented behavior. The PR must still state the exception.

## Pull request completion rule

A material PR is complete only when:

1. Code and tests implement one bounded decision.
2. The final diff matches the scope contract.
3. Relevant canonical docs reflect the resulting code and approved future direction.
4. Obsolete statements are removed.
5. `tasks/todo.md` lists remaining work rather than completed history.
6. `docs/START-HERE.md` reflects changed handoff or operational state.
7. Documentation-impact CI passes.
8. One bounded review checks intent against the diff.
9. User-facing changes receive browser/mobile verification when applicable.
10. Outside-scope findings become follow-up work.

## Codex operating practices

For large changes:

- begin in analysis/Ask mode with an implementation plan;
- structure the task like a GitHub issue with goal, owner, paths, constraints, acceptance checks, and stop conditions;
- keep work to a small reviewable PR rather than an open-ended mission;
- provide a configured environment and deterministic tests;
- use `AGENTS.md` as a map to deeper docs;
- let Codex inspect the app, screenshots, logs, and test evidence where possible;
- use Codex review as an additional reviewer, not as the sole product approver;
- capture repeated review feedback as a doc rule, test, lint, or script.

## Documentation gardening

At each major milestone, and periodically during active development:

1. compare `docs/START-HERE.md` with current `main`, open PRs/issues, CI, Vercel, and hosted persistence;
2. compare product docs with actual UI and engine tests;
3. compare architecture docs with package imports and persistence adapters;
4. compare `tasks/todo.md` with completed PRs;
5. remove obsolete statements rather than appending contradictions;
6. open one focused correction PR.

A future scheduled Codex task may automate the comparison and open a proposed PR, but it should not silently rewrite product decisions.

## Review question

Before merge, ask:

> Could a new conversation read `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md` and continue correctly without this chat?

If not, the PR is not complete.
