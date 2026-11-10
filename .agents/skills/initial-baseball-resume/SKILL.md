---
name: initial-baseball-resume
description: Resume autonomous engineering in kastnerjon/initial-baseball from verified repository and deployment state. Use when starting a new engineering session, reviewing unfinished PR work, or preparing a project handoff.
---

# Initial Baseball — verified engineering resumption

This is a procedure, not authorization to merge, deploy, change product scope,
use production credentials, or enable feature flags. The repository's canonical
documents outrank any previous conversation summary.

1. **Read the operating contract.** Inspect `AGENTS.md`,
   `docs/START-HERE.md`, `tasks/todo.md`, and the relevant canonical
   product/specification/implementation plan. Preserve package boundaries,
   signed scoring invariants, hidden-answer privacy, immutable publication,
   guest play versus account-owned Custom issuance, and release flags.
2. **Establish live state.** Confirm the current `main` SHA, open and recently
   merged PRs (including stacked bases), exact-head CI checks, independent
   review coverage and unresolved comments. Check matching Vercel Preview and
   production states, and isolated QA versus production Supabase migration
   status where the task needs them. Unverified historical notes are hypotheses.
3. **Choose a safe next milestone.** Identify the highest-priority authorized,
   unblocked task. Write the repo-required scope contract and owning layer.
   If using multiple agents, first apply
   `docs/engineering/parallel-agent-pilot.md`: different owner and worktree
   for each task; no simultaneous edits to one critical scoring/schema contract.
4. **Implement and verify.** Keep source/test changes focused. Run targeted
   tests and relevant full checks, request genuine independent PR review,
   reconcile final-head CI and deployment evidence, and never conflate a QA
   rehearsal with production approval. Do not repeatedly trigger rate-limited
   reviewers or circumvent gated credentials.
5. **Checkpoint accurately.** Update canonical operational docs only with
   verified facts, remaining blockers, and next exact actions. Record branch,
   base/head SHA, PR, tests, review state, Vercel/QA observations and which
   product flags remain OFF. Never claim completion for pending checks.
6. **Continue when safe.** A review, PR, merge or deployment is a checkpoint,
   not automatically the end of the session. Stop only for genuine
   authorization, risk, access or execution limits; advance another independent
   authorized milestone when possible.

If a required connector or environment is unavailable, report the precise
verification gap. Do not invent tool outputs or substitute a production change.
