# Resolved-at-bat browser 6A: durable attempt journal and outbox

Status: Implementation scope
Date: 2026-09-18

## Scope contract

Goal: add the durable browser attempt journal and immutable resolved-at-bat outbox/retry client required by the approved browser lifecycle without activating collection.

Owning layer: `apps/web` browser persistence/delivery adapters.

In scope:

- versioned local-storage key and fail-closed journal codec;
- one stable points-v3 attempt ID per journal;
- monotonic ownership generation field and explicit generation advance;
- active/retired contribution state;
- immutable per-pitch schema-1 `DailyAtBatResultSubmission` append;
- terminal delivery states `submitted`, `conflict`, and `rejected`, with transient failure remaining `pending`;
- retirement on local same-slot fact conflict or terminal server conflict/rejection;
- exact stored-payload delivery/retry and single-flight deduplication within one client instance;
- compare-before-write protection using attempt identity, slot, generation, and exact frozen payload;
- injected storage, ID, and request ports plus focused tests;
- canonical documentation/handoff reconciliation.

Out of scope:

- Web Locks or any claim of cross-tab authority;
- React/gameplay integration or shared gameplay-save writes;
- creation eligibility for fresh versus legacy saves;
- gameplay save -> journal -> POST sequencing;
- Reset-today UI behavior or gameplay clearing;
- completed-result submission-ID reuse;
- live calls from gameplay to `POST /api/daily/at-bats`;
- comparison reads/UI, Supabase changes, server/API changes, Classic AB collection, IndexedDB, accounts, or server sessions.

Acceptance checks:

- focused journal/client tests cover durable creation, generation fencing, immutable append, retirement, exact retry, response classification, one-tab single-flight delivery, ordered pending retry, and stale async responses;
- strict web typecheck/test plus repository typecheck/test/lint/file-size/documentation checks pass;
- final diff remains browser-adapter/docs only and collection remains inactive.

Stop conditions:

Any required server schema/API change, portable gameplay-state change, React wiring, IndexedDB/server-session addition, or alteration to the approved fresh/legacy/reset policy must be split into the appropriate later PR instead of expanding 6A.

## End-state fit

6A is intentionally useful before activation but not sufficient for safe collection. The journal persists the fields later stages need so no storage-schema rewrite should be necessary:

- 6B will make the generation meaningful by advancing it only under one long-lived exclusive Web Lock owner;
- 6C will decide when a fresh run may create a journal, gate gameplay persistence on ownership, and apply reset/legacy/crash reconciliation;
- 6D will freeze terminal native facts only after gameplay-save success, invoke this delivery client, retry pending entries after ownership/hydration, and reuse the attempt ID for a new completed-result record when eligible.

A retired journal is never rotated into a new contributor. Existing pending observations remain retryable. Invalid/corrupt storage fails closed. These choices prefer anonymous undercount to duplicate, reconstructed, or forked observations.
