# Daily lineup quality

Status: Canonical portable generation and validation contract

## Ownership

`packages/daily` owns the nine-slot policy, deterministic selection, repeat-window filtering, canonical candidate ranking, and lineup validation. `packages/baseball-data` supplies canonical player facts, recognizability inputs, redirects, and reveal readiness. Persistence and usage-history retrieval remain behind future repository adapters. React, Next.js routes, databases, and Vercel do not own these rules.

## Slot policy

- At-bats 1–2: recognizability rank 1–250.
- At-bats 3–4: rank 251–1,000.
- At-bats 5–6: rank 1,001–2,500.
- At-bats 7–9: rank 2,501–5,000.

A lineup contains nine distinct canonical players. Automatic generation excludes canonical players used from one through exactly 90 Daily dates before the target date. A player last used 91 or more days earlier is eligible.

Recognizability bands apply to the canonical candidate stream. Source rows are ranked first by the established recognizability inputs, then canonical redirects/deduplication are applied. Beginning September 2, 2026, surviving canonical candidates receive dense ranks `1..N`; alias/source duplicates therefore do not consume rank positions. This fixes the production exhaustion mode in which source ranks 1–250 represented only 173 distinct canonical players.

## Determinism and compatibility

Generation seed context explicitly includes the Daily date, reviewed data/recognizability version, stable algorithm version, slot, and canonical player ID. Identical inputs produce identical ordered output. A changed date, reviewed data version, or algorithm version creates a different seed context.

Historical references are resolved through an injected canonical resolver. Source and legacy IDs remain compatibility inputs; generated and persisted lineup identity uses canonical IDs. To preserve already-established `lineup-quality-v2` history, generated dates from the July 22, 2026 quality launch through September 1, 2026 retain the original source-rank interpretation. September 2, 2026 is the explicit dense-canonical-ranking cutover. Published/manual puzzle IDs are not rewritten by this ranking correction.

Manual selection is not a second rule path: it receives the same duplicate, rank-band, repeat, resolution, and reveal-readiness validation as generated selection.

## Provider-neutral inputs

Pure generation accepts candidate records and historical usage as values. It does not query a database, clock, browser store, network, or hosting API. Future repository/services retrieve usage and editorial records, then call the portable functions.

## Editorial validation

Validation returns one stable record per slot containing:

- expected minimum and maximum recognizability rank;
- actual recognizability rank;
- canonical player ID;
- duplicate status;
- recent-use status and latest Daily usage;
- generated or manual selection source;
- reveal readiness;
- ordered warnings.

Warnings cover missing canonical identity, missing recognizability rank, rank-band violations, canonical duplicates, recent use, and missing reveal data. Insufficient eligible pools fail clearly rather than silently widening a band or repeat window.

## Explicit exclusions

This contract does not choose a database, persist puzzles, implement draft/scheduled/published/archived lifecycle states, authenticate editors, render administration UI, submit completed-game results, configure Vercel, or apply the heritage/compact-scorebook presentation.
