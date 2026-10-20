# Custom Lineup numbered-slot picker and swap

## Scope contract
- Goal: In the gated v2 creator, show nine numbered searchable slots by default; allow choosing 1–10 positions and two-tap swap of any two populated positions.
- Owner: apps/web creator UI; pure slot transforms live next to its components.
- In scope: Per-slot canonical autocomplete with sourced career years and teams, replace/duplicate checks, non-drag swap, fixed slot count/issued order, mobile and keyboard-accessible buttons, focused tests.
- Out of scope: Legacy v1 creator, new player-data contracts, DB/score/attempt changes, public flags, real hosted/mobile QA, publishing and Discover.
- Acceptance: 1–10 lengths, duplicate prevention, swap preserves canonical IDs, no incomplete/holey issuance, CI/typecheck/tests/file size, READY Preview and bounded independent review.
- Stop: If authoritative search no longer provides teams/years or new public privileges are required, make a separate architecture decision instead of inventing metadata.
## Product behavior
The dropdown defaults to nine. All numbered positions appear vertically from the start. Search within a specific position through the existing canonical search endpoint; suggestions distinguish identities with canonical display name, playing years and career teams. Creator selects or replaces any slot directly. A Swap button selects one occupied slot and a second button selects the occupied destination. No dragging, no gaps in issued lineup, no duplicate canonical identity. Shortening lineup length discards trailing positions with an explicit explanation.
## Documentation impact
Reconciles the owner-approved v2 creator interface. Release remains gated pending isolated credential-backed hosted QA, trusted ingress/WAF and real mobile acceptance. No public activation or identity/scoring change.
