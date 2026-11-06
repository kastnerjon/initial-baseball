# Secondary official Daily scoring admission (#566)

Proposed design for architecture review. Keep secondary contributions disabled until the implementation, hosted QA and release gates in the multi-Daily plan pass.

## Existing boundaries

The Daily progression token authenticates puzzle identity and game counters. It carries neither a competitive attempt identity nor a durable transition revision. Existing submissions take routing fields from the caller. The at-bat repository deduplicates by attempt, puzzle, ruleset and pitch; the completion repository resolves collisions by submission ID. Revalidating a scorecard against the same nine players cannot establish which edition produced it.

## Start and resume

1. Resolve the frozen publication by immutable ID and the server's Pacific game date. Verify the issued ruleset. Never issue live eligibility from an archive or practice start.
2. Bind the reservation to an established, high-entropy anonymous browser credential via a server-side digest. A unique constraint over credential digest, puzzle ID and ruleset lets concurrent starts return the same durable attempt. Generate its ID on the server. Separate the practice path so it cannot consume someone's first live reservation.
3. An existing live reservation retains its original eligibility after midnight, including pending retries. Credential loss starts a separate anonymous identity. Do not assign multiple competitive reservations during simultaneous first opens while the browser has no shared credential. Competitive starts for that condition stay disabled until real two-tab QA demonstrates convergence.
4. Sign a versioned, domain-separated progression envelope carrying the attempt ID, exact puzzle ID, date, issued ruleset and revision. Verify the signature before selecting a population. Match every bound field against the stored attempt and credential. Keep scoring keys server-only; document key retention and maximum retry lifetime before activation.

## One authoritative transition

Use the existing shared engine and frozen publication to derive each transition. Adapt the reservation and compare-and-swap pattern from Custom v2 while keeping Daily eligibility independent of Custom ownership. Commit against the expected predecessor revision. Persist the accepted command identity, successor state and response needed for a lost-response replay. Identical retries return that committed result; a different command against the same predecessor returns a conflict and resumes from the winning state.

For a terminal at-bat, write the server-derived observation in the same transaction. For game completion, project from the accepted ledger and commit once using a stable server-generated submission ID. Use unique constraints on attempt/pitch and attempt/completion. Bind the population to the stored date, ID and ruleset. No caller-supplied scorecard, title, display number or roster hash selects the population. A failed transaction contributes nothing. Apply the same eligibility check to per-batter and completed-game writes.

## Verification before integrating public gameplay

- Two same-date editions with identical rosters and hints: swap ID, credential, signed token, attempt, ruleset and scorecard independently. Assert zero unintended rows in either population.
- Race identical and different commands from two tabs, retry after commit with the response lost, roll back an interrupted transition, refresh mid-at-bat, then finish. Inspect reservation, pitch, completion and comparison row counts.
- Exercise last-minute live start and delayed retry after Pacific midnight, first archive practice, two empty tabs, cookie loss, malformed credentials, and a browser previously used for Custom. Confirm legacy primary and historical result behavior.
- Demonstrate that browser roles cannot write the ledger or its projections directly. Accept only server-authorized transitions. Rehearse additive migrations in isolated QA and exercise rollback with issued games and queued retries.
- A separate architecture review must settle initial browser credential convergence, recovery/expiry and atomic persistence before modifying submission authority. Production schema, public activation and physical-device acceptance remain separate release gates.
