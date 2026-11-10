# Parallel AI engineering pilot

Status: staged procedure, **not evidence that multiple coding agents are running**.
Owner: lead engineering agent. Date: November 8, 2026.

## Objective

Increase *verified* work completed per session without weakening scoring integrity,
review independence, safe release, or the canonical source of truth. First pilot:
at most two independently scoped implementation workstreams plus a separate
review/QA function. Do not parallelize merely to maximize agent count.

## Admission rules

Before delegating, the lead agent must check current main, the open PR graph,
relevant issues, exact-head CI and Vercel state, and QA vs production Supabase
boundaries. Read `AGENTS.md`, `docs/START-HERE.md`, `tasks/todo.md` and the
applicable canonical spec. Each workstream gets:

- A task/issue, named owner, observable acceptance goal and explicit stop conditions.
- A branch from the **verified main SHA** (or declared stacked dependency), its own
  checkout/worktree, and a limited list of owned paths.
- Clear forbidden files and flags, relevant tests, and no shared credentials.
- A handoff containing base SHA, head SHA, changed files, commands/results,
  independently reviewed findings, and remaining blockers.

No agent may modify another agent's worktree, force-push another agent's branch,
rewrite canonical specs to justify a change, or reuse a reviewer who authored
the change as its sole independent reviewer.

## What can and cannot run in parallel

Suitable first pilots: an isolated browser regression and a separate read-only
operational audit or documentation/QA task with no shared source contracts.

Sequence instead of swarming: signing and exact-ID scoring contracts; migrations
and service authorization; shared game-engine scoring rules; feature activation;
or two tasks modifying the same authority boundary. Such work can use a second
agent for **read-only review**, not competing implementations.

## GitHub overlap audit

`scripts/report-open-pr-workstreams.mjs` provides a **read-only filename-overlap
signal** for direct-to-main PRs and lists stacked PRs separately. It does not
declare real merge conflicts, account for semantic coupling between different
files, or certify CI, reviews or releases.

After its workflow is merged, use GitHub Actions → **AI workstream overlap
audit** → **Run workflow** on main. The report appears in the workflow's job
summary. This is a manual, trusted-main action with read-only GitHub permissions.
Its tests run on changes to the script/workflow in PRs. No third-party plugin,
persisted token, production database or new dependency is required.

## Integration and stop gates

The lead agent alone integrates work, verifies that each PR still matches its
scope, reconciles overlapping files and release assumptions against **current**
main, and checks final-head CI/Preview plus independent reviews. Hosted QA,
physical devices, migrations and feature flags keep their existing separate
approvals. Any unresolved scoring, security, identity, hidden-answer, or database
integrity conflict stops the affected merge, not unrelated authorized work.

Do not claim a swarm was executed unless two or more distinct implementation
agents actually ran separate authorized tasks and their traceable outputs
survived integration. A CodeRabbit/Codex reviewer, CI job or GitHub script is
not automatically a second implementation agent.

## Pilot evaluation

Compare against the prior single-agent workflow: independently verified PRs
integrated, escaped regression/reopen rate, overlapping-file remediations,
review turnaround, total elapsed engineering time, and operator coordination.
Record concrete evidence in `docs/START-HERE.md` after the pilot. Prefer the
simpler single-agent workflow if coordination overhead exceeds the benefit.
