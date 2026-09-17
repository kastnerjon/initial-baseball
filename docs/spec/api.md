# Daily web API specification

Status: Living source of truth  
Last updated: 2026-09-17

Daily routes are thin Next.js adapters over canonical baseball data, engine rules, and portable Daily logic. Answer-integrity rationale is in `docs/decisions/0001-daily-answer-integrity.md`.

## General rules

Every route must validate input, return sanitized data, keep rules in their owning packages, avoid per-action persistence, and never reflect secrets or hidden answer data in errors. Public search returns canonical player IDs. Daily resolution may compare a syntactically canonical submitted ID directly with the server-only canonical answer ID; legacy/noncanonical IDs cross the canonical redirect boundary before comparison.

## Public bootstrap

The Daily server runtime can create a new-session bootstrap for exactly one of two approved current modes: default Daily Nine `points-v3` or Classic Inning `classic-inning-v1`. The selected ruleset is returned explicitly as `rulesetVersion` and is signed into the first progression token and every authorized hint checkpoint. The public `/` page requests `points-v3`; `/classic` requests `classic-inning-v1`. Both routes use the same Pacific date/puzzle and shared browser game implementation, while their local persistence namespaces remain separate.

A bootstrap receives:

- `rulesetVersion` for the authorized new session;
- puzzle ID, number, date, status, hint configuration, and nine public initials;
- one opaque signed progression token for the first pitch;
- one authorized hint bundle for the first pitch only.

The active hint bundle contains:

- current pitch number and already revealed depth;
- all four current-batter hint labels/values;
- signed checkpoints for only the later reveal depths still available from the current claims.

It contains no answer ID, answer name, reveal record, or future-batter hint. Existing valid `points-v2`, `points-v1`, and `legacy-inning-v1` signed sessions retain their own policies even though those compatibility rulesets are not selectable for a new bootstrap.

## Canonical player search

### `GET /api/players/search`

Returns sanitized canonical candidates. Search aliases help retrieval but do not define reveal names. Genuine duplicate visible names receive career years only; teams and positions are not shown in public guess results.

Search-candidate construction is owned by the search route/runtime path. It is not initialized merely because `/api/daily/resolve` is invoked.

## Active hint-bundle restoration

### `POST /api/daily/hints`

Request:

```json
{ "progressionToken": "opaque-signed-token" }
```

The server verifies the token and returns the bundle for exactly the authorized current pitch, strike count, reveal depth, and signed ruleset.

```json
{
  "hintBundle": {
    "pitchNumber": 3,
    "revealedCount": 2,
    "hints": [
      { "slot": 1, "hintType": "main_decade", "hintLabel": "Main decade played in", "hintValue": "2000s" }
    ],
    "checkpoints": [
      { "revealedCount": 3, "progressionToken": "opaque-token" },
      { "revealedCount": 4, "progressionToken": "opaque-token" }
    ]
  }
}
```

The response is `private, no-store`. It is used only to restore a compatible saved at-bat whose current bundle is no longer in memory. It rejects invalid, completed, cross-date, cross-puzzle, or arbitrary-future claims.

## Legacy one-hint route

### `POST /api/daily/hint`

This compatibility route still verifies one token and returns one hint plus one successor token. The active web client no longer calls it when the player presses Hint. Production build QA rejects the exact legacy route string from client chunks.

## Daily resolution

### `POST /api/daily/resolve`

Guess:

```json
{
  "progressionToken": "opaque-signed-token",
  "submittedPlayerId": "canonical-or-legacy-player-id"
}
```

Give Up:

```json
{
  "progressionToken": "opaque-signed-token",
  "giveUp": true
}
```

Response:

```json
{
  "result": {},
  "reveal": null,
  "progressionToken": "next-opaque-token",
  "hintBundle": null
}
```

Every resolution response, including rejected requests, includes a diagnostic `Server-Timing` header of the form:

```text
Server-Timing: daily-resolve;dur=<milliseconds>
```

`daily-resolve` measures route-handler processing after the serverless module has initialized. Comparing it with real-browser end-to-end latency therefore helps isolate remaining browser/network/platform-startup overhead. It does not change the JSON contract, does not make the response cacheable, and contains no puzzle, player, answer, reveal, credential, or signing data.

Behavior:

- incorrect guess: no reveal, successor token with one additional strike, refreshed bundle for the same pitch and strike count;
- correct guess: current reveal, successor token, next-pitch bundle unless complete;
- third strike/Give Up: current reveal, recorded out, successor token, next-pitch bundle unless complete;
- all point rulesets complete after the scheduled ninth at-bat, even if three strikeouts have already been recorded;
- `classic-inning-v1` and `legacy-inning-v1` use the engine-owned non-points completion policy: third recorded out or scheduled ninth at-bat, whichever comes first;
- every completed successor token returns `hintBundle: null`, so Classic never authorizes a later batter after out three.

The server transport delegates this completion decision to engine `isDailyGameComplete`; routes and React do not duplicate the three-out rule.

Canonical-format submitted IDs are compared directly with the server-only canonical answer ID. This avoids loading the full canonical player index for the ordinary public-search path. A noncanonical/legacy submitted ID is still validated through the canonical redirect boundary; unknown or excluded legacy IDs are rejected. A syntactically valid but nonexistent canonical ID is simply an incorrect anonymous guess. This does not expose the answer or create a score advantage, and it avoids turning full-universe identity validation into a per-guess hot-path cost.

Terminal responses load only the deterministic reveal shard for the canonical answer ID. They do not require the full player index solely to locate that shard. Search and legacy redirect behavior continue to use the full canonical runtime when those capabilities are actually needed.

The browser does not submit pitch, hint depth, strike count, out count, or ruleset version independently. The signed progression token remains authoritative for those claims. After a terminal response, the browser derives the awarded point display from the engine policy and the server-verified reveal/strike facts. For points-v3, a correct resolution awards max(0, 7 - hints revealed - wrong guesses); a third wrong guess or Give Up records K and 0. The route does not duplicate a client-trusted point value.

## Local Hint action

The active client performs no HTTP request on Hint click. It:

1. finds the next current-batter hint in the already authorized bundle;
2. reveals it locally;
3. replaces the current progression token with the matching signed checkpoint.

The checkpoint preserves the server-selected ruleset as well as pitch, strike, and reveal claims. Scoring/completion therefore still uses server-verifiable progression on the later resolution request.

## Token contract

Claims contain only contract/ruleset version, puzzle ID/date, current pitch, reveal count, strike count, recorded outs, and completion. Tokens contain no hints or answers.

Valid pre-ruleset tokens normalize to `legacy-inning-v1`. Valid `classic-inning-v1`, `points-v1`, `points-v2`, and `points-v3` claims round-trip without reinterpretation. Ruleset identity is signed and cannot be changed by a client without invalidating the token signature. Tokens are stateless and replayable; anonymous scoring is not tamper-proof. The runtime issues Classic bootstrap claims for `/classic` and points-v3 claims for `/`; the browser does not choose or rewrite the signed ruleset after bootstrap.

## Browser persistence

The browser persists public gameplay state and the current opaque token, not the full authorized hint bundle. On ordinary transitions, the server response supplies the next bundle. On refresh, `/api/daily/hints` hydrates the bundle before the restored at-bat becomes interactive. Daily Nine keeps the existing `initial-baseball:daily:<date>` namespace so points-v1/points-v2/points-v3/legacy saves remain compatible. Classic maps the same date key into a distinct Classic namespace, so load/save/clear/reset in one mode cannot overwrite the other. Persistence is a browser adapter concern; the signed token remains authoritative for ruleset/pitch/strike/reveal claims.

Completed-result transport uses a separate local marker namespace rather than changing the gameplay-save schema. For a completed native `points-v3` or `classic-inning-v1` game, the browser creates one UUID-style `submissionId`, persists it as `pending` before network I/O, and reuses that exact ID after refresh or transient failure. `created`/`existing` responses mark the marker submitted; HTTP 409 marks a terminal conflict; ordinary validation 4xx marks it rejected; network and 5xx failures remain pending for retry. Reset clears both the gameplay save and the matching result-submission marker. Compatibility `points-v2`, `points-v1`, and `legacy-inning-v1` saves are not submitted.

## Completed-game result submission

### `POST /api/daily/results`

The request is the shared schema-1 `DailyCompletedResultSubmission` transport:

```json
{
  "schemaVersion": 1,
  "submissionId": "browser-generated-stable-id",
  "puzzleId": "daily-2026-09-17-editorial-v1",
  "puzzleDate": "2026-09-17",
  "puzzleNumber": 144,
  "rulesetVersion": "points-v3",
  "completedAtBats": []
}
```

Only current native `points-v3` and `classic-inning-v1` result submissions are accepted. The server uses the submitted date/ruleset only to locate the authoritative public puzzle, then engine `validateDailyCompletedResult` binds the complete payload to that puzzle/game, verifies ordered native facts/completion, and derives the summary through existing engine rules. Client totals/extras are never persistence authority.

The normalized result is passed to the portable 4B completed-result service and the server-only Supabase adapter. Persistence is atomic first-write-wins on `submissionId`: the adapter attempts `INSERT`; PostgreSQL unique violation `23505` triggers a read of the already-stored winner. No result route uses preflight read-before-write, upsert, update, or overwrite.

Responses:

- first insert: `201 { "status": "created" }`;
- exact idempotent retry: `200 { "status": "existing" }`;
- malformed/unsupported/mismatched/incomplete result: `400 { "error": "<safe-code>" }`;
- same ID plus different normalized result: `409 { "error": "idempotency_conflict" }`;
- provider/configuration failure: `500 { "error": "completed_result_unavailable" }`.

Every response is `private, no-store`. The route returns neither stored raw facts/summary nor provider details, answer IDs, credentials, or service-role information. This is one post-completion write only; hints and guesses remain write-free.

## Caching and privacy

- Bootstrap/public page data may use safe revalidation.
- The fully materialized server-only public Daily puzzle is cached by puzzle date with a 300-second safety revalidation window; successful authenticated admin saves invalidate that cache.
- The materialized cache may contain server-only answer IDs and hint data required for authorized resolution, but it is never itself a public response and does not alter bootstrap serialization rules.
- Hint-bundle, one-hint, resolution, and completed-result responses are `private, no-store`; resolution/completed-result responses themselves are never cached.
- Resolution responses may expose only the diagnostic `daily-resolve` timing duration above in addition to their normal sanitized body/headers.
- Logs must not include signing secrets, answer IDs, credentials, full reveals, or provider error text from completed-result persistence.
- No Redis, replay cache, per-action database write, or durable anonymous session is required.

## Private Daily lineup ChatOps

### `POST /admin/daily/chatops`

This is a server-to-server operational adapter, not a browser or public gameplay API. It exists so an authorized assistant transport can apply one exact future nine-player lineup without manually replacing nine admin slots.

Authorization uses `Authorization: Bearer <DAILY_CHATOPS_TOKEN>`. The token is server-only, must be at least 32 characters, and is checked before privileged Supabase repository construction. Successful operations use the fixed audit actor `chatops:assistant`.

Request:

```json
{
  "puzzleDate": "2026-09-18",
  "canonicalPlayerIds": ["canonical-1", "canonical-2", "canonical-3", "canonical-4", "canonical-5", "canonical-6", "canonical-7", "canonical-8", "canonical-9"],
  "schedule": true
}
```

The request requires exactly nine unique, reviewed canonical Daily candidate IDs in batting order and an explicit schedule boolean. The route rejects malformed input, unknown candidates, and current/past dates. It ensures a draft exists for the future date, then delegates one atomic lineup replacement to the existing Daily workflow/lifecycle. Published and archived records remain immutable. Replacing a scheduled future puzzle returns it to draft before an explicit schedule transition.

The response returns the persisted puzzle date/number/status/revision, the ordered canonical IDs/display names for readback, and the existing lineup validation result so the assistant can surface repeat/recognizability warnings rather than silently weakening them. It is `private, no-store`.

Supabase remains persistence only. The concrete connected-assistant transport is the non-exposed `private.dispatch_daily_lineup_chatops(text, text[], boolean)` function installed by `supabase/migrations/20260916130000_enable_daily_chatops_transport.sql`. It is `SECURITY INVOKER`, retrieves the bearer token from Supabase Vault at dispatch time, and uses `pg_net` only to POST the JSON request to this route. Execution is revoked from `public`, `anon`, and `authenticated`. The function contains no lineup/lifecycle rules and never writes `daily_editorial_puzzles` directly. Because this repository is public, future lineup payloads must not be transported through GitHub issues, commits, pull requests, or public Actions inputs. Operational details and credential setup are in `docs/operations/daily-lineup-chatops.md`.

## Deferred APIs

Aggregate/comparison reads and UI, accounts, authoritative streaks/leaderboards, and head-to-head/social APIs require separate decisions. The compact completed-game write path above is implemented independently of those reads.
