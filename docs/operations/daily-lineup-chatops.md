# Daily lineup ChatOps

## Additional official editions — source-staged, not enabled

Issue #663 tracks the owner's request to manage multiple official Daily editions through ChatGPT. The existing primary-only workflow below is unchanged. The separate edition **server route and editorial service are source-staged**; no additional-edition database/assistant transport is supplied or approved, and this is not evidence of production authorization.

`POST /admin/daily/editions/chatops` requires both edition-editor and edition-ChatOps flags and the existing server-only ChatOps bearer. Its bounded JSON envelopes are `create` with a dated named draft and nine ordered canonical IDs, `lookup` with an exact future date and edition key, `preview` with an exact occurrence UUID, `revise` with that UUID, expected revision and nine ordered canonical IDs, and `schedule` with that UUID, the reviewed revision and explicit confirmation, and **separate `issue`** with the scheduled occurrence UUID, its expected revision and `confirmed: true` after a second explicit owner approval. Create and revise never schedule; schedule never issues. The new `issue` action additionally requires exact-true `OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED`; the other private draft actions remain independently gated. The new `issue` action uses the same previously reviewed atomic, server-only immutable issuance service as the restricted admin editor, including exact frozen-publication readback. It returns only the verified `puzzleId` and `created`/`existing` status, never frozen clues. Lookup and preview never write. Mutations return their verified result; only draft operations expose private roster readback. This still has **no approved assistant transport**, and issuance does not authorize public play or scoring. Verify the database-atomic Pacific-date gate in #664 before production release.

**Transport security hold (#666):** The earlier shared-queue `pg_net` proposal and a subsequently explored synchronous SQL HTTP prototype are removed from this PR's final source diff. Neither is approved to carry private future lineup identities or reusable credentials. Production primary Daily still uses the older `pg_net` path and requires a separate, reviewed remediation. Before activating this new endpoint, design a confidential assistant-to-application transport, secure the caller and responses, exercise protected hosted HTTP and lost-response recovery, and implement the database-atomic Pacific-date guard (#664). No future lineups should be sent via the currently unapproved SQL HTTP approaches; do not bypass the authenticated application service with direct table writes.

### Uncertain outcomes — manual recovery until tested

An HTTP or transport timeout does not prove the write failed. Never issue a different draft or advance to scheduling just because a response was lost. For an existing known occurrence, privately `preview` the exact occurrence and compare status, revision, title and ordered canonical IDs with the reviewed request. If a revision or scheduling response was lost and the readback shows the requested state at the expected next revision, it is consistent with success but does not by itself establish which concurrent actor made the change; review the authoritative state before proceeding. If an **issue** response was lost, privately preview the occurrence; when status is `issued`, verify the exact immutable publication identity and original ordered roster through the trusted server-side issuer/readback. Never repeat a write at a guessed revision or silently create a replacement edition. If publication status or exact roster cannot be reconciled, stop and investigate. If the revision is unchanged and the draft is still the expected draft, retry only the same intended operation with that same expected revision. Any other status, revision, roster, missing occurrence or unavailable readback is ambiguous: stop and investigate rather than blindly retrying or scheduling.

Create retries use the existing date/edition uniqueness and exact-draft recovery; do not change input or create a second edition after a timeout. If the occurrence ID is unknown, use private `lookup` with the exact future date and edition key and verify the full returned identity, revision, status and ordered roster. An existing matching draft is consistent with success but does not prove which concurrent request created it; review the state. A missing or conflicting result, unknown outcome, or failed read requires investigation, not a blind mutation. The lookup and this manual recovery sequence still require independent review and hosted timeout/concurrency acceptance.

Status: operational in production; smoke-tested September 16 and exercised for routine owner-supplied future lineups September 17, 2026.

## Goal

Allow the owner to provide a future Daily date and nine players in conversation and have an authorized assistant apply that exact lineup without manually editing nine slots in `/admin/daily`. The same private path also supports bounded same-day correction while an editorial record remains `scheduled`, plus an exceptional owner-authorized reset of today's live deterministic fallback via an explicit draft replacement and immediate scheduling.

This is an operational adapter only. It does not replace the existing admin UI, lineup generator, lifecycle, validation, repository, or publication model.

## Architecture

The authoritative mutation path remains:

`assistant request -> private Supabase transport -> authenticated server adapter -> Daily admin workflow -> packages/daily lifecycle -> Supabase repository`

`packages/daily` continues to own lifecycle and lineup-domain behavior. Supabase remains persistence only. The assistant must never write `daily_editorial_puzzles` directly.

The repository is public, so future lineup payloads must never be placed in GitHub issues, pull requests, commits, Actions inputs, or other public repository surfaces. GitHub is not the ChatOps transport.

The private transport is `private.dispatch_daily_lineup_chatops(...)`, installed by `supabase/migrations/20260916130000_enable_daily_chatops_transport.sql`. It uses `pg_net` to forward JSON to the production ChatOps route and reads the bearer token from Supabase Vault at request time. The function is `SECURITY INVOKER`, lives in the non-exposed `private` schema, and has execution revoked from `public`, `anon`, and `authenticated`. It contains no lineup or lifecycle rules.

## Server boundary

`POST /admin/daily/chatops` accepts a JSON object containing:

- `puzzleDate`: `YYYY-MM-DD`;
- `canonicalPlayerIds`: exactly nine unique canonical, reveal-ready Daily-compatible player IDs in batting order;
- `schedule`: explicit boolean.

Automatic generation remains restricted to ranked `dailyEligiblePlayers`. Authorized manual ChatOps replacement may select a canonical, reveal-ready player outside that automatic pool. Such a selection remains unranked for automatic generation and returns the advisory validation warning `outside-automatic-daily-pool`; it does not promote the player into `dailyEligiblePlayers` or change future generated lineups.

Authorization is a dedicated `Bearer` token from server-only `DAILY_CHATOPS_TOKEN`. The configured token must contain at least 32 characters and is compared through a timing-safe digest. Authorization occurs before the privileged Supabase repository is constructed. Successful mutations are audited as `chatops:assistant`.

The route:

1. validates the request shape and calendar date;
2. ensures the requested date has an editorial record;
3. validates all requested IDs against the canonical, reveal-ready manual editorial candidate universe;
4. for a future date, atomically replaces all nine selections through the ordinary editable lifecycle and returns a previously scheduled puzzle to draft;
5. for the current date, corrects an existing `scheduled` lineup atomically; for an owner-approved reset of a fallback puzzle, it also accepts an existing `draft` **only when `schedule: true` is explicit**, replaces the draft, and immediately schedules it; the public deterministic fallback remains available until scheduling completes;
6. reruns the existing horizon/lineup validation and returns rank-band, repeat, automatic-pool, and other warnings for conversational review;
7. optionally schedules only when `schedule: true` was explicit; a current already-scheduled correction treats this as an idempotent transition;
8. returns the persisted date, puzzle number, status, revision, validation result, and resolved ordered selections.

Published and archived puzzles remain immutable. Replacing a scheduled future lineup returns it to draft before an explicit schedule transition. A normal same-day full-lineup correction is allowed only while the current record is already `scheduled`; it is one optimistic-revision save that preserves scheduled lifecycle metadata. An exceptional owner-authorized current-day fallback reset may instead replace a `draft` with an explicit `schedule: true` request, using the already-read draft revision as its save precondition. The route may then receive the explicit `schedule: true` action as usual, and the workflow treats that already-scheduled current puzzle as an idempotent schedule transition. Because public puzzle identity is derived from the ordered canonical lineup, the corrected lineup receives a new puzzle ID automatically while earlier results remain attached to the old ID. Repository optimistic-revision semantics remain intact.

## Conversational operating procedure

When the owner supplies a lineup:

1. preserve the supplied batting order;
2. resolve each name to one canonical player ID using the existing canonical search/identity system;
3. never guess through a missing or ambiguous identity; surface ambiguity and request the one needed clarification;
4. for a same-day correction, read back the authoritative current row first, require `scheduled` status, preserve all unchanged slots exactly, and send `schedule: true`;
5. present meaningful validation warnings rather than silently weakening repeat protection, automatic eligibility, reveal readiness, or identity rules;
6. treat `outside-automatic-daily-pool` as an advisory manual-curation warning, not a reason to substitute a different player without the owner's instruction;
7. ask whether to schedule when that intent is not already explicit; same-day correction always preserves the already-scheduled state and therefore uses `schedule: true`;
8. call `private.dispatch_daily_lineup_chatops(puzzle_date, canonical_ids, schedule)` through the connected Supabase project;
9. capture the returned `pg_net` request ID, then inspect `net._http_response` for the corresponding status/body after the asynchronous request completes;
10. on a normal 2xx response, require the returned persisted readback to exactly match the requested date, order, status, and nine canonical players;
11. if `pg_net` reports a transport timeout, do **not** blindly retry: first read the authoritative editorial record for that date. If the exact nine/order/status and `chatops:assistant` audit metadata are already persisted, treat the mutation as completed and record the timeout as a transport anomaly. Retry only when authoritative readback proves the requested mutation did not complete.

Do not publish from this conversational operation. Publication remains a separate lifecycle action.

This procedure is intentionally durable across chats. A future assistant should begin with `AGENTS.md`, `docs/START-HERE.md`, and `tasks/todo.md`, then use this runbook for lineup operations. The Supabase connection must be available in that chat; if it is not connected, reconnect the existing Initial Baseball Supabase project rather than inventing another transport.

## Production setup — completed September 16, 2026

1. Supabase app connected to project `initial-baseball-db` / `dwreeiydvwikpamlokji`.
2. Private transport migration merged/applied; `pg_net` and `private.dispatch_daily_lineup_chatops(...)` are active.
3. A random 64-character machine credential was generated without exposing it in chat.
4. `DAILY_CHATOPS_TOKEN` is configured in Vercel Production and production was redeployed so the route reads it.
5. The matching credential is stored in Supabase Vault as `daily_chatops_token`; it is not hard-coded in SQL, source control, logs, or browser code.
6. The transport reached the production route successfully. An invalid Daily candidate was rejected atomically with HTTP 400 before any lineup mutation.
7. The corrected September 18, 2026 / Daily #145 lineup was dispatched through the private transport, persisted in exact batting order, and scheduled. The persisted record reached revision 2 with `scheduled_by` and `updated_by` equal to `chatops:assistant`.
8. On September 17, owner-supplied future Dailies #149–#151 were resolved through the canonical identity system, persisted in exact batting order through the private transport, and scheduled. The persisted seven-day horizon then covered Dailies #145–#151 with no draft gaps. Future player names and canonical IDs remain intentionally absent from public repository history.
9. One routine dispatch timed out at the `pg_net` transport after the server had already committed the exact scheduled lineup. Direct authoritative readback confirmed revision 2, exact order, and `chatops:assistant` attribution before any retry; a second routine dispatch returned HTTP 200 normally.

## QA gate

Verified before routine production use:

- request parser rejects malformed/impossible dates, wrong counts, duplicates, empty IDs, and implicit schedule intent;
- auth rejects absent, short, and incorrect tokens without exposing the configured value;
- full-lineup replacement is one optimistic-revision save and preserves exact order;
- unknown, non-canonical, or non-reveal-ready players are rejected before mutation;
- reveal-ready manual players outside the automatic Daily pool may be selected and are surfaced with `outside-automatic-daily-pool` rather than being silently promoted into automatic generation;
- past dates remain rejected; ordinary current-date corrections require `scheduled`, while an owner-approved current-day fallback reset additionally permits `draft` only with explicit `schedule: true`; missing/published/archived current-day records cannot be replaced;
- published/archived puzzles remain immutable;
- future scheduled replacement returns to draft and only explicit scheduling restores `scheduled`;
- same-day scheduled correction preserves the scheduled lifecycle atomically, while draft reset uses a checked optimistic revision followed by explicit scheduling; either replacement changes the derived puzzle identity and leaves prior result rows isolated under the old puzzle ID;
- cache invalidation still runs through the existing repository wrapper;
- validation warnings are returned for conversational review;
- normal 2xx response readback exactly matches the requested nine;
- timeout recovery checks the authoritative editorial row before retrying and never assumes that a transport timeout means the server mutation failed;
- the private transport is not executable by `public`, `anon`, or `authenticated` and the `private` schema is not exposed through the Data API;
- no future lineup content appears in public GitHub surfaces or browser payloads;
- full CI, documentation checks, preview deployment, production deployment, credential activation, production transport dispatch, atomic rejection, exact persisted readback, and explicit scheduling were exercised.

## Deferred

The admin UI may be redesigned later, but it is intentionally out of scope. Automatic publishing, published-puzzle correction/versioning, bulk lineup recipes, and direct assistant database writes are also out of scope.

### Owner-authorized current-day fallback reset

A live Daily without an editorial row is normally served from the deterministic fallback.
A valid ChatOps call for today's date first creates an editorial draft via `ensureHorizon`.
When the owner explicitly accepts interrupting active gameplay and supplies `schedule: true`,
the endpoint may replace that draft and schedule it. Normal same-day corrections still use
the atomic `scheduled` path. Missing, published and archived editorial rows remain
ineligible for a direct replacement (and past dates are rejected). This exception does not
grant permission for direct database mutations.

**Consequences that must be disclosed to the owner:** the replacement remains the same
calendar date and Daily number, but receives a different lineup-derived puzzle ID.
Signed progression tokens for the old lineup stop working; clients must refresh.
Points-v4 gameplay, completed-submission storage and result comparisons are puzzle-ID
scoped, so new visitors and refreshed clients start a separate puzzle. Old
recorded results stay associated with the original ID and should not be deleted or
merged into the replacement leaderboard. Other rulesets or clients may need an
explicit reset. An owner-approved live reset should therefore be exceptional.

Verify the ChatOps HTTP response and the authoritative scheduled editorial row's
exact nine canonical IDs and audit identity, then check the public page after
cache invalidation. Never report completion based on the `pg_net` dispatch ID alone.

### Source-staged secure ChatGPT MCP secondary publishing (#666; default OFF)

The new stateless Streamable HTTP endpoint is \`POST /api/official-daily/mcp\`, with
RFC 9728 OAuth resource discovery at \`/.well-known/oauth-protected-resource\`.
This is the **secondary edition** assistant transport, not the legacy primary
\`pg_net\` workflow. It replaces neither primary authorization nor primary
ChatOps. The MCP server invokes the existing editorial application services
for player search, create, exact private lookup/preview, revision-checked
nine-player revise, separately confirmed schedule and separately confirmed
immutable issue. It does not enqueue requests in SQL, directly edit tables,
or use external destinations chosen by tool arguments.

Deployment defaults to **404**. No feature is available until both
\`OFFICIAL_DAILY_EDITOR_MCP_ENABLED=true\` and
\`OFFICIAL_DAILY_EDITOR_DRAFTS_ENABLED=true\` are explicitly present. The
\`issue_official_daily_draft\` tool additionally requires
\`OFFICIAL_DAILY_EDITOR_ISSUANCE_ENABLED=true\`; scheduling never issues. The
MCP transport never enables public competitive play or new starts.

A proposed separately approved QA-only OAuth setup must provide:

- \`OFFICIAL_DAILY_EDITOR_MCP_RESOURCE_URL\` — exact HTTPS resource endpoint
  \`https://<approved-QA-host>/api/official-daily/mcp\`, with no query/fragment;
- \`SUPABASE_URL\` — isolated QA Supabase origin, reused by the existing
  server-only Supabase adapter, **not** a new service-role credential;
- \`OFFICIAL_DAILY_EDITOR_MCP_CLIENT_ID\` — dedicated approved OAuth 2.1 client,
  not a primary ChatOps shared token;
- \`OFFICIAL_DAILY_EDITOR_MCP_USER_ID\` — single explicitly approved UUID of the
  editorial owner; this is an allowlist, never a claimed request argument;
- an asymmetric Supabase JWT signing key (ES256/RS256). Verify the OAuth
  authorization-code/PKCE and consent configuration, supported client
  registration, and **resource-specific access-token \`aud\`**. Supabase's
  normal \`aud=authenticated\` does **not** pass this MCP resource verifier.
  A narrowly scoped OAuth-specific custom access token hook may be required;
  changing that Auth policy is a separate approval/security review.

Every request must pass exact URL, Host/Origin/Fetch Metadata, HTTPS,
bearer-JWT signature/JWKS, exact issuer, exact resource audience, \`exp\`/\`iat\`,
OAuth \`client_id\`, authenticated role and allowlisted \`sub\` **before any
service-role client is created**. The OAuth metadata is public but contains
only resource and authorization-server URLs, never credentials. The MCP
response is private/no-store, text errors are restricted to fixed
\`invalid\`/\`conflict\`/\`unavailable\` classes, and tool arguments are bounded
at ingress. The app does not persist JWTs, roster payloads or responses in
a shared request/response queue; no future-lineup payload goes to GitHub,
logs, URL queries or CI fixtures. Use synthetic fixture identities for tests.

**Authoring sequence:** privately resolve all nine identities and order;
create draft; read back the exact occurrence and revision; revise as necessary;
ask the owner explicitly whether to **schedule** that exact roster/revision;
perform confirmed schedule; privately read back scheduled state and revised
revision; ask the owner **separately** whether to **issue** this exact scheduled
edition; call confirmed issue and verify immutable publication ID. A lost or
ambiguous response is never permission to advance: use exact private
lookup/preview, reconcile the immutable publication, and retry only with
verified original revision/state. Do not manufacture a replacement edition.

**Pre-activation/rollback:** keep all production flags OFF and do not rotate
the existing nonexportable QA key A. Require final-head independent review,
CI/Preview, approved isolated-QA OAuth registration and user allowlist, secure
log/redaction and host-level rate limits, real ChatGPT plugin OAuth consent,
synthetic hosted create→preview→revise→confirmed schedule→confirmed issue and
readback with duplicate/stale/timeout/concurrency tests. Roll back the connector
by disabling the MCP flag without changing gameplay or publication state.
An already immutable issued edition cannot be "unissued." Existing primary
\`pg_net\` queue transport still requires separate controlled remediation;
do not reuse it for secondary unpublished lineups. The genuine Pacific-midnight
editor lock gate (#664), key rotation and #657 production authorization are
not waived by an MCP source merge.
