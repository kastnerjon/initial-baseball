# Custom v2 — standalone hosted QA runner, all 1–10 lengths

Status: Staged QA tooling only; actual hosted HTTP execution still pending.

## Scope contract
- Goal: Make the existing real HTTP→Next.js→hosted Supabase Custom v2 QA runner valid for the isolated standalone Free-plan QA project, and exercise every supported N=1–10 without changing production.
- Owning layer: apps/web/scripts release-verification tooling.
- In scope: Explicit nonproduction project-ref naming, HTTPS-only exact-host staging endpoint preflight, production-ref hard denial, all N=1–10 challenge issuance and signed progression, preflight negative Node tests; corresponding runbook and checkpoint.
- Out of scope: Obtaining privileged QA credentials, executing against hosted Supabase without those credentials, database changes, application/gameplay/UI changes, production public feature flag, creator accounts, abuse controls or General Availability.
- Acceptance: Node syntax/security-preflight checks, mocked contract tests remain green, exact-head CI SUCCESS, Preview READY, independent bounded fresh-eyes review. Never claim hosted E2E has passed until actually executed.
- Stop conditions: Any need for production DB credentials, unsafe network origin, or code changes outside QA tooling.

## Architecture and threat model
Only the self-launching QA script and its tests own QA provenance and endpoint validation. Runtime application transport, database credentials, game rules and browser DTOs remain unchanged. The runner refuses the hard-pinned production project ID and any non-HTTPS or noncanonical URL, and launches its own Next process. Operator must independently verify the credential is issued for the staged project; client-side checks cannot prove this.

The Supabase organization is on Free, so database branches cannot be created. A separate no-cost QA project, ref iklbnlicgsxxhaoiscor, was created and hosted PostgreSQL rollback tests passed, then was paused. The runner supports this standalone project (and eligible disposable branches), not just branches.

## Evidence classification
No full application-to-hosted-DB gameplay is proved by Node preflight, mocked HTTP, or hosted SQL-only tests. Running against an independently provisioned nonproduction service key, inspecting fixtures and safe teardown is required. Public Custom v2 flag remains OFF.
