# Daily Nine comparison read activation proof reconciliation

Status: in progress  
Date: 2026-09-19

## Scope contract

- **Goal:** reconcile canonical GitHub documentation with the already-verified production state of PR #204, without changing runtime behavior.
- **Owning layer:** repository documentation/handoff state.
- **In scope:** record PR #204 merge and exact production deployment proof; mark comparison GET reads live/default-on; preserve the server-only emergency disable semantics; identify asynchronous browser/UI comparison as the next bounded concern; remove stale "activation in progress" / "comparison API inactive" wording.
- **Out of scope:** browser fetching; React/UI; retry or caching policy; Supabase schema/functions/indexes; result-write behavior; scoring; Classic comparison; rollups; R5/R6/R8; deployment or environment mutations.
- **Acceptance checks:** docs agree that PR #204 merged at `178e58cb6fcb8f09ad9ebc3e6ba69cca7a725a01`; exact production deployment `dpl_F87hcE51cQT6zhoCp8MgGKwCSX38` is READY; both September 19 comparison routes returned HTTP 200 versioned live payloads with `Cache-Control: private, no-store`; comparison-route runtime error scan is clean; docs clearly state browser/UI consumption is not implemented.
- **Stop conditions:** any required code, deployment, environment, persistence, scoring, cache, or UI change moves to a separate PR.

## Documentation impact

Update the activation plan plus canonical handoff/architecture/todo/read-API documentation only. This PR exists to make GitHub state match production reality after PR #204; it does not change behavior.
