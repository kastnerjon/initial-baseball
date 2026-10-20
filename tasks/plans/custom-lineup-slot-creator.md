# Custom v2 slot-based creator — approved October 20, 2026

## Scope contract
- Goal: Display X vertically numbered player slots, nine by default and selectable from one through ten. Each slot uses canonical player autocomplete including MLB first/last season and teams. Replace a slot or exchange two players via Swap then target slot.
- Owner: apps/web creator UI; pure slot transforms alongside existing web creator-selection transforms.
- In scope: V2-only fixed slots, per-slot search/dropdown, existing canonical search metadata, duplicate protection, atomic two-tap swap, responsive CSS and tests.
- Out of scope: v1 admin interface, canonical records or search algorithm, Custom issuance and gameplay, flags, authentication, storage, My Results, publishing/Discover.
- Acceptance: default nine empty slots, all 1–10 lengths, arbitrary slot assignment and replacement, no duplicates, entire-player swaps, no issuance until all slots filled, CI/Preview and independent review.
- Stop: any request for new data providers, player identity changes, database or public enablement requires a separate decision.

Changing lineup length removes trailing slots and their selections. Canonical IDs, not display names, are issued in displayed order. This UI does not activate public Custom creation.

## Documentation impact
Records agreed creator interaction while preserving canonical server/engine authority and existing feature gates.
