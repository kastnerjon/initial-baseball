# Daily Five — prospective editorial draft constructor

Status: Bounded pure domain staging step; not activated.

## Scope contract
- **Goal:** Build and validate an explicit five-slot prospective Daily editorial draft while keeping legacy nine-player draft creation unchanged.
- **Owner:** packages/daily portable editorial domain.
- **In scope:** explicit lineup-contract-v2 draft constructor, shared existing date/actor/selection validation and ordering, exact-five and invalid-input regression tests, canonical documentation.
- **Out of scope:** Existing editorial service/repository read-write, Supabase codecs, five-player generator policy, admin UI, schedule/publish/issue, current Daily Nine/Archive/Classic, activated gameplay or web flags.
- **Acceptance:** exact five canonical nonduplicate slots in order, contract marker 2, rejection of 4/6 slots and invalid date/ID/actor, existing nine validator behavior intact; targeted tests plus exact-head full CI, independent review and READY Preview.
- **Stop conditions:** Requires new storage schema, changes historical nine output, schema v3 issuer, or generic calendar/revision abstraction.

## Architecture
Existing pure dailyPuzzleLifecycle owns editorial validation; share its private draft initialization and version-aware selection validator. Return a distinct prospective record carrying lineupContractVersion=2, not accepted by the current nine-only createDraft service as an action. Neither this constructor nor this PR persists anything. Next work must add version-aware persistence and protected draft editor before actual scheduling; five-player generator selection and activation remain unapproved.
