# Pre-quota validation of public Custom Lineup selections

## Scope contract
- Goal: reject malformed, duplicated or out-of-range anonymous player selections without consuming the finite private creation quota.
- Owning layer: the public Custom Lineup HTTP route in apps/web, reusing the portable @initial-baseball/daily selection contract.
- In scope: lightweight 1–10 selection validation before quota admission, focused negative tests, and canonical documentation.
- Out of scope: database/schema, canonical catalog checks, hint rules, WAF, creator UI, scoring, authentication, activation, or admin issuance.
- Acceptance: malformed requests return the existing 400 response without calling the quota RPC; distinct selections of 1–10 still use the normal issuance flow; CI, exact-head READY Preview, fresh-eyes review.
- Stop: stronger catalog validation, new identity formats or different security assumptions require a separate review.

## Architecture and compatibility
Reuses createCustomLineupSelection rather than duplicating the selection rule. Canonical existence and hint availability stay with the server-authoritative issuer after budget reservation, so well-formed unknown IDs may still spend quota. The response shape, persistence, signed attempts and current release flags do not change.

## Documentation impact
Updates this plan, current work list, and public Custom creation route specification. No live data or configuration changes.
