# Completed-result native browser activation

Status: Active scope contract  
Date: 2026-09-17

## Goal

Activate the merged completed-result browser delivery client from genuine native Daily Nine / Classic completion without retroactively submitting compatibility-restored history or allowing local replay/reset to mint duplicate aggregate contributions.

## Owning layer

Web save hydration + React/game composition only.

## Architecture check

- Engine remains the gameplay/completion/scoring authority.
- The merged browser delivery client owns immutable payload persistence, retry classification, stable idempotency identity, and same-tab single-flight behavior.
- The merged POST API remains the server-authoritative puzzle/result-validation boundary.
- This PR decides only when gameplay may create a new delivery record and when hydration may retry an existing one.
- Native-fact provenance remains local browser metadata; it does not enter portable game state or change the persisted gameplay-save schema.

## In scope

- expose hydration-only provenance distinguishing explicit native completed-at-bat facts from compatibility reconstruction;
- preserve existing gameplay save schema and compatibility normalization;
- on hydration, retry any already-persisted pending delivery record independently of gameplay completion state;
- permit new result-record creation only when the current compatible session is eligible for native telemetry and later genuinely completes;
- do not retroactively create a result record from an already-completed restored save that predates delivery bookkeeping;
- do not clear result-delivery bookkeeping when “Reset today” clears gameplay state, because a server aggregate row cannot be un-submitted and replay must not mint another browser contribution;
- wire both Daily Nine (`points-v3`) and Classic (`classic-inning-v1`) through the same game component/client boundary;
- focused provenance + activation/reset tests;
- reconcile START-HERE, architecture wiring map, API/data-model notes, todo, and this scope contract.

## Out of scope

- changes to the browser delivery client, POST API, 4A/4B contracts, or Supabase schema;
- aggregate/comparison reads or UI;
- accounts/cross-device identity;
- retroactive migration/submission of old completed saves;
- stronger anti-cheat;
- background retry workers/timers/service workers;
- archive/history.

## Acceptance checks

- compatible active/new sessions may create a result record only after genuine native completion;
- already-completed restored saves with no result record do not create one;
- existing pending result records retry after hydration even if gameplay state is no longer completed;
- compatibility-reconstructed completed-at-bat facts never create a result record;
- gameplay reset leaves result-delivery identity untouched;
- Daily Nine and Classic keep their separate ruleset-scoped identities;
- no portable game-state or persisted gameplay-save schema change;
- focused/full CI, documentation-impact, and Vercel preview pass;
- production merge is followed by one controlled native completion/readback and identical retry row-count check before comparison work begins.

## Stop conditions

Stop and split if activation requires changing portable gameplay contracts, the result client/API/schema, account identity, aggregate reads, or generalized retry infrastructure.
