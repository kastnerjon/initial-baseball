# Daily web API specification

Status: Living source of truth  
Last updated: 2026-10-09

Daily routes are thin Next.js adapters over canonical baseball data, engine rules, and portable Daily logic. Answer-integrity rationale is in `docs/decisions/0001-daily-answer-integrity.md`.

## General rules

Every route must validate input, return sanitized data, keep rules in their owning packages, avoid per-action persistence, and never reflect secrets or hidden answer data in errors. Public search returns canonical player IDs. Daily resolution may compare a syntactically canonical submitted ID directly with the server-only canonical answer ID; legacy/noncanonical IDs cross the canonical redirect boundary before comparison.

## Staged private Custom Nine challenge issuance

`POST /api/custom-nine/challenges` is an **administrator-authenticated, same-origin creation endpoint**, not a public creator flow. It accepts a JSON object containing only `canonicalPlayerIds`: an explicitly ordered array of exactly nine distinct canonical IDs. Requests are bounded to 4,096 bytes. The existing Basic admin principal must be authorized **before** request body processing or any persistence connection. Invalid credentials return 401, missing admin configuration 503, cross-origin mutations 403.

The server validates exact ordered selection, resolves all nine against its canonical gameplay-ready player source, materializes the existing four Daily hints in that order, creates a fresh cryptographically random UUIDv4 puzzle ID with `custom-nine-v1-` prefix, freezes the ruleset `points-v4`, and first-write-wins inserts the complete answer-bearing snapshot through the existing service-role-only private repository. Success returns HTTP 201 with **only** `{ "puzzleId": "custom-nine-v1-<uuidv4>" }` and `Cache-Control: private, no-store`. The 201 response also sets a host-only, HttpOnly, SameSite=Strict, exact-challenge-path-scoped creating-browser cookie (Secure over HTTPS). Its value is a server-signed Custom-specific HMAC marker bound to that immutable puzzle ID; no browser `isCreator` flag is trusted. Signing configuration is preflighted before immutable issuance. A future result admission boundary must block a verified creator marker and treat malformed or duplicated markers as invalid, not as proof of a non-creator. There is still **no Custom Nine results POST endpoint** and this marker does not itself gate a write. Cookies can be removed, expire or be evicted; anonymous cross-device identity cannot be established without authentication. The creating browser is not an account-grade identity. There is no public creator UI, shareable/playable URL or gameplay transition in this checkpoint. Repeating the same lineup request deliberately mints another challenge; no idempotency key has yet been implemented.

Invalid selection or JSON returns 400 (oversized 413), unknown player/unsupported hints 422, immutable ID conflict 409, and storage/unexpected failures 503. Errors are generic and must never expose canonical IDs, future hints, credentials, or provider details. All created challenge records remain server-private. **Public anonymous creation is deferred** until a separate explicit write-abuse/rate-limit and creator-exclusion decision; opening this admin-only write endpoint does not make account-free creators operational.

## Custom Nine redacted public challenge metadata

`GET /api/custom-nine/challenges/{puzzleId}` is a public, read-only metadata endpoint. The URL contains the **opaque, versioned UUIDv4 challenge ID**; it is not an authorization token for hint progression or result contribution. Valid IDs are checked against the existing `custom-nine-v1-<uuidv4>` contract *before* connecting to the server-only Supabase client. Invalid or unknown challenge IDs return identical HTTP 404 JSON `{ "error": "not_found" }`. Store errors, corrupt or incompatible records, or missing server configuration return sanitized HTTP 503 `{ "error": "challenge_unavailable" }`; raw provider exceptions are never returned.

An existing challenge returns HTTP 200 with an explicitly projected shape: `{ "puzzleId": "...", "rulesetVersion": "points-v4", "atBats": [{ "pitchNumber": 1, "initials": "..." }, ...] }`. `atBats` contains exactly nine records in their **frozen selected order**, exposing only the same pre-play initials that Daily Nine already displays. No canonical player IDs, full names, hint layout/values, issuance timestamp, answer records, service-role information, or progression tokens are serialized. All responses carry `Cache-Control: private, no-store`.

The underlying private repository still reads and validates the full immutable record on the server. This endpoint has **no writes**, no game bootstrap, and **does not make the challenge playable**; signed active-at-bat hint progression and spoiler-safe resolution are later bounded work. Do not treat a client-supplied `puzzleId` as an authority for scoring or answer revelation.

## Custom Nine signed opening session (staged)

`GET /api/custom-nine/challenges/{puzzleId}/bootstrap` is a read-only, **anonymous but signed** opening-session bootstrap for an already-issued challenge. It validates the opaque `custom-nine-v1-<uuidv4>` before any Supabase access, then reads the immutable record through the existing private service-role repository. Invalid or nonexistent IDs return `404 { "error": "not_found" }`; missing configuration, corrupt records or provider faults return sanitized `503 { "error": "session_unavailable" }`. Every response is `Cache-Control: private, no-store`.

The 200 JSON has only `puzzleId`, fixed `rulesetVersion: "points-v4"`, ordered public `atBats: [{pitchNumber, initials}]`, a signed opening `progressionToken`, and `hintBundle` **for batter one only** (the same four currently active hint values and the four signed reveal-depth checkpoints used by the Daily runtime). No canonical player IDs, names, future batters' hint values, issue timestamp or private challenge record are serialized. The shared Daily runtime is reused solely to create the session and active bundle from the **frozen issued** clue snapshot; no clue values are regenerated for this request.

Custom Nine HMAC signatures are **domain-separated** from Universal Daily/Classic/Archive, derived from the existing server-side `DAILY_PROGRESSION_SECRET` using a fixed Custom Nine v1 context. Tokens are not accepted by the Universal Daily endpoints or vice versa. The standard Daily claims schema uses an internal non-calendar sentinel `1970-01-01` for Custom Nine and the exact challenge ID for binding; the sentinel is not an issue date and is not returned in the API body. This checkpoint **does not yet expose hint-advancement, guessing, answer reveal, submission, sharing or creator UI endpoints**. A valid signed opening token alone does not authorize competitive results; those require separate exact-challenge checks and creator-exclusion policy.

## Custom Nine signed current-batter hints (staged)

`POST /api/custom-nine/challenges/{puzzleId}/hints` restores the authorized active batter's frozen four-hint bundle and remaining signed reveal-depth checkpoints; `POST /api/custom-nine/challenges/{puzzleId}/hint` returns **one next hint** and the signed successor token. Both accept **only** `{ "progressionToken": "opaque-signed-token" }` as a JSON object (max 4,096 request bytes), and neither allows guessing, batter advancement, answer reveal, result contribution or browser UI access. The client can also advance locally with the signed checkpoints already present in the bundle, identical to existing Daily Nine.

Both endpoints check the URL challenge ID, then cryptographically verify the token with the **Custom-only HMAC signing domain** and require claims bound to exactly that ID, the non-calendar Custom sentinel date, an incomplete session and the immutable `points-v4` ruleset **before** reading the private issued challenge. They load and validate the server's frozen clue snapshot and reuse Daily runtime hint selection/checkpoint issuance; they do not recompute hints from live facts. Only the token-authorized batter's hint values can be returned. The full private challenge and canonical names/answer IDs are never serialized.

Malformed/forged/cross-domain/cross-challenge/cross-ruleset/completed tokens return `400 { "error": "invalid_progression" }`, invalid/unknown challenge IDs return `404 { "error": "not_found" }` and unavailable configuration/provider/private records return sanitized `503 { "error": "session_unavailable" }`. Every status, including errors, is `Cache-Control: private, no-store`. Tokens are stateless and replayable (the existing anonymous-game limitation); these endpoints never write to Supabase. Custom results, creator exclusion, resolution and public creator UI remain later stages.

## Custom Nine signed guess resolution (staged)

`POST /api/custom-nine/challenges/{puzzleId}/resolve` accepts a bounded (4,096-byte) JSON object with **exactly** a signed `progressionToken` and one action: `submittedPlayerId` (nonempty string, maximum 200 characters) **or** `giveUp: true`. Extra client claims, simultaneous actions, arbitrary score/out counts and other fields are rejected. It uses the **Custom Nine-only** signature domain from opening bootstrap and exact versioned challenge ID, fixed sentinel date, immutable `points-v4` ruleset and incomplete signed session; token checks occur before private Supabase reads. Universal, Classic, Archive and other Custom challenge tokens cannot authorize resolution.

The server reads the immutable, private issued challenge and constructs the same frozen nine-batter puzzle used by bootstrap/hint hydration. It delegates guesses, strikes, score-policy facts, Give Up, next-batter advancement and ninth-batter completion to the **existing Daily runtime**. Ordinary canonical IDs compare directly with the current frozen answer ID; legacy IDs use the existing canonical redirect boundary. Incorrect guesses return `{ result, reveal: null, progressionToken, hintBundle }` with refreshed current-batter state. A correct guess, third strike or Give Up includes a canonical reveal of the **terminally resolved current batter only** and a Custom-signed successor token. `hintBundle` includes the now-authorized next batter only, or `null` after the ninth batter. No future answer ID/name or later-batter clue is serialized, and errors never reflect private content.

Malformed requests, forged/wrong-domain/wrong-challenge/wrong-ruleset/completed tokens return sanitized `400 { "error": "invalid_progression" }`; malformed/unknown challenge IDs return `404 { "error": "not_found" }`; provider, configuration or reveal-read failures return `503 { "error": "session_unavailable" }`. All responses use `Cache-Control: private, no-store`. These calls **do not persist attempts, completed results, comparisons or leaderboards**. Stateless signed-token replay remains the existing anonymous-game limitation. Custom creator participation limits, results isolation and browser UI are separate stages.

## Custom Nine server-signed terminal evidence (staged)

The existing Custom Nine `POST /api/custom-nine/challenges/{puzzleId}/resolve` adds `terminalReceipt` to its successful response: `null` for an incorrect, nonterminal guess, and a server-signed `cnr1` receipt for a terminal correct guess, third strike or Give Up. The receipt binds the exact challenge, terminal pitch number and frozen initials, engine-derived outcome, token-authorized hint depth, signed wrong-guess count and resolution type. It also commits to SHA-256 digests of the signed pre- and post-resolution progression tokens. Its HMAC key is domain-separated from Universal Daily progression and other Custom cookie/progression keys. It does not contain canonical answer IDs, names, raw progression tokens or future hints.

Receipts are **not** competitive result submissions and not a proof of one uninterrupted honest first play. Custom progression remains stateless and replayable, so independently valid terminal receipts can be replayed/branched. Before enabling result storage, a distinct admission stage must address whole-attempt continuity/first-write-wins, reject creator or invalid creator-browser markers, verify signed terminal facts against the frozen issued puzzle, and derive points on the server. This stage adds no public results-write API, DB writes, comparison read, public creator UI or new access grant.

## Private Custom Nine complete-attempt evidence verification (staged)

The server-only `createCustomNineAttemptEvidenceVerifier` validates a bounded envelope of exactly nine ordered records, each containing a `cnr1` terminal receipt and its before/after signed progression tokens. It checks receipt HMACs and token HMACs in their separate Custom-only domains, hashes against each receipt's predecessor/successor commitments, exact challenge and `points-v4` identity, frozen ordered initials, token-authorized hint depth and strike counts, engine-correct terminal outcomes, strikeout/Give Up out-count effects, between-batter continuity (pitch number and out count), and ninth-batter completion. It passes only the verified terminal facts to the existing engine `validateDailyCompletedResult` to derive native normalized points-v4 scoring. This verifier performs no database I/O or HTTP handling; malformed evidence raises a generic error, never private puzzle information.

**Limitation, enforced by the release sequence:** The current stateless HMAC protocol can issue more than one legitimate signed branch from an earlier checkpoint. Two independently valid branches can pass this nine-batter consistency verifier; it **does not prove first play, unique session identity, or replay resistance**. A future competitive write must introduce a separately reviewed authoritative monotonic-attempt/first-write policy (or an explicit acceptance of weaker anonymous integrity), plus creator-browser exclusion, before exposing any result submission. No private result table writes, new public routes or anonymous grants are enabled by this checkpoint.

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

Normalized queries consisting solely of two or more separated single letters return HTTP 200 with `{ "results": [] }` through the shared engine search policy. Direct HTTP calls receive the same initials-shortcut restriction as the browser. Ordinary name fragments and aliases retain the existing response contract.

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

Valid pre-ruleset tokens normalize to `legacy-inning-v1`. Valid `classic-inning-v1`, `points-v1`, `points-v2`, `points-v3`, and `points-v4` claims round-trip without reinterpretation. Ruleset identity is signed and cannot be changed by a client without invalidating the token signature. Tokens are stateless and replayable; anonymous scoring is not tamper-proof. The runtime now issues points-v4 bootstrap claims for `/` and Classic claims for `/classic`; historical signed claims keep their original exact ruleset.

## Completed-game result submission

### `POST /api/daily/results`

This anonymous endpoint accepts exactly one completed-game submission for an exact supported result ruleset: `points-v3`, `points-v4`, or `classic-inning-v1`. It is not called per hint, guess, or at-bat. H3 permits exact v3/v4 browser completed-result delivery records (plus retained Classic where enabled) under separate ruleset keys; after H5b the ordinary public Daily creates v4 records while existing v3 records remain immutable and separately keyed.

Request contract:

```json
{
  "schemaVersion": 1,
  "submissionId": "stable-client-id",
  "puzzleId": "stable-puzzle-id",
  "puzzleDate": "2026-09-17",
  "puzzleNumber": 144,
  "rulesetVersion": "points-v3",
  "completedAtBats": []
}
```

The route performs only transport handling. Server composition first rejects unsupported schema/ruleset values, invalid calendar dates, and future Pacific dates before loading a puzzle. It then loads the same authoritative public puzzle used by gameplay through the server Daily runtime using the exact routed ruleset, without minting a progression token or building an active hint bundle.

Engine `validateDailyCompletedResult` remains the authority for puzzle identity, ordered native facts, completion consistency, and summary derivation. Client-supplied totals, answer fields, and unknown extras are never persisted as authority. A successful normalized result flows through the 4B first-write-wins service and the server-only Supabase provider.

Responses expose only status/error codes:

- `201 {"status":"created"}`: first successful insert for the submission ID;
- `200 {"status":"existing"}`: identical idempotent retry;
- `409 {"error":"idempotency_conflict"}`: the ID already belongs to a different normalized result;
- `400 {"error":"..."}`: malformed, unsupported, inconsistent, incomplete, future, or mismatched submission;
- `503 {"error":"completed_result_unavailable"}`: known provider/configuration unavailability;
- `500 {"error":"completed_result_unavailable"}`: unexpected server fault.

Every response is `private, no-store`. The route does not return normalized at-bat facts, score summaries, answer IDs/names, hints, credentials, or provider details.

The endpoint is consistency-authoritative, not proof of honest anonymous play. It deliberately does not introduce an account, durable gameplay session, per-action event log, or stronger anti-cheat model. The browser client adapter owns a separate immutable delivery record containing the exact schema-1 payload, one stable `submissionId`, and local delivery status. H3 permits exact v3/v4 browser completion delivery under ruleset-keyed records; gameplay activation is still gated by browser-local provenance, so only a genuine current-session native completion may create a new record while an already-persisted pending record may retry without recreating facts.

## Resolved-at-bat result submission

### `POST /api/daily/at-bats`

This anonymous server boundary accepts one terminal Daily Nine AB observation for exactly `points-v3` or `points-v4`. It is separate from `/api/daily/resolve`; gameplay resolution never waits for this persistence path. H3 permits the browser journal/outbox to produce exact v3/v4 observations under separate ruleset identity. The ordinary public game still produces v3 today because `CURRENT_DAILY_RULESET_VERSION` remains v3.

Request contract:

```json
{
  "schemaVersion": 1,
  "attemptId": "stable-run-id",
  "puzzleId": "stable-puzzle-id",
  "puzzleDate": "2026-09-18",
  "puzzleNumber": 145,
  "rulesetVersion": "points-v3",
  "atBat": {
    "pitchNumber": 7,
    "initials": "RH",
    "outcome": "3B",
    "hintsRevealed": 1,
    "wrongGuesses": 1,
    "resolution": "correct"
  }
}
```

Server composition preflights only object/schema/date/ruleset fields required to route the request and rejects future Pacific dates before puzzle loading. It then loads the same authoritative cached public puzzle used by gameplay using the exact routed ruleset, calls engine `validateDailyAtBatResult` with that exact version, and stores the normalized result through the Daily first-write-wins service and server-only Supabase provider. Client points, answers, timestamps and unknown extras are discarded; the engine derives `awardedPoints`.

Responses expose only status/error codes:

- `201 {"status":"created"}`: first insert for the observation key;
- `200 {"status":"existing"}`: identical immutable retry;
- `409 {"error":"idempotency_conflict"}`: the key already belongs to different normalized facts/metadata;
- `400 {"error":"..."}`: malformed, unsupported, inconsistent, future or mismatched observation;
- `503 {"error":"at_bat_result_unavailable"}`: known provider/configuration unavailability;
- `500 {"error":"at_bat_result_unavailable"}`: unexpected server fault.

Every response is `private, no-store` and contains no normalized facts, points, answer IDs/names, hints, credentials or provider details. This consistency boundary is not proof of a unique person or honest play. Browser attempt identity, atomic cross-tab ownership, immutable outbox/retry and reset/legacy behavior remain authoritative for whether the app sends observations. H3 widens those browser producer paths to exact-version points-v3/points-v4 while preserving the same schema-1 payload and ruleset-keyed journal/lock identity; this is still compatibility infrastructure because the public default remains points-v3.

## Daily Nine comparison reads

### `GET /api/daily/comparison/at-bat`
### `GET /api/daily/comparison/completed`

These read-only adapters accept exact Daily Nine comparison rulesets `points-v3` or `points-v4`. They take routing fields only (`date`, `ruleset`, and `pitch` for the at-bat route), load authoritative puzzle identity server-side, and read the exact puzzle + exact ruleset population. Classic, legacy, points-v1 and points-v2 are unsupported at this comparison boundary.

Schema 1 carries exact ruleset identity. At-bat responses return resolved count plus nullable average points. Completed responses return completed count, nullable average total points, and an offset histogram interpreted by the exact ruleset: v3 has 64 slots for 0..63 in one-point steps; v4 has 73 slots for 0..36 in 0.5-point steps. The browser requires response identity to match the request exactly. Fractional v4 values are valid numbers, not rounded integers.

Comparison reads remain `private, no-store`, asynchronous, fail-quiet and off gameplay's critical path. Active-slot prefetch may begin before terminal resolution, but comparison data remains hidden until the user's engine-derived own points exist. Provider/read failures do not block gameplay or result persistence.

## Browser persistence

The browser persists public gameplay state and the current opaque token, not the full authorized hint bundle. On ordinary transitions, the server response supplies the next bundle. On refresh, `/api/daily/hints` hydrates the bundle before the restored at-bat becomes interactive. The historical pre-v4 Daily family (`legacy-inning-v1`, points-v1, points-v2, points-v3) keeps the existing `initial-baseball:daily:<date>` key so already-started old sessions can still restore under the current points-v3 compatibility policy. Current-Daily points-v4 uses `initial-baseball:daily:ruleset:points-v4:<date>:puzzle:<encoded-puzzle-id>`. Its prior date/ruleset key is a backward-compatible read fallback: matching puzzle identity can restore, known other-puzzle identity is ignored, and unclassifiable values remain present/unusable so contribution fails closed. Reset clears the scoped value and matching/unidentified fallback while preserving known other-puzzle state. Future rulesets require an explicit storage/compatibility decision. Points-v4 therefore cannot read, overwrite, clear or reset the historical v3-era value, and points-v3 explicitly rejects a v4 payload. Classic remains in its distinct `initial-baseball:daily:classic:<date>` namespace, while permanent archive saves remain puzzle+ruleset keyed. No H2 path copies, deletes or rewrites an existing save. Persistence is a browser adapter concern; the signed token remains authoritative for ruleset/pitch/strike/reveal claims. Completed-result retry bookkeeping uses the separate `initial-baseball:daily-result-submission:v1:<ruleset>:<date>:<puzzle>` namespace and never mutates the Daily save. The record is written before the first POST and stores the exact submission payload, not merely the ID. A pending record survives refresh and retries the same ID **and the same raw facts** even if current gameplay/replay state differs. The client exposes `allowCreate=false` so activation code can retry an existing record without retroactively creating one from an old completed save. Gameplay reset preserves the independent delivery identity across local replay because a server aggregate row cannot be un-submitted. Resetting local gameplay therefore cannot mint another browser contribution for the same puzzle/ruleset. Terminal delivery status is local bookkeeping, not gameplay or aggregate authority.

Before `POST /api/daily/at-bats` is called from gameplay, a separate version-1 points-v3/points-v4 attempt journal/outbox is persisted under its exact puzzle/ruleset namespace. One long-lived exclusive Web Lock with the same exact ruleset identity owns the contributing run across tabs. Only the owner may write the shared gameplay save or journal; another tab remains passive until takeover, then reloads durable state before continuing. Each terminal commit persists gameplay first, appends the exact immutable schema-1 request second, and only then starts the POST. Reset after any local observation retires the journal before clearing gameplay. Hydration mismatches retire contribution without reconstructing facts. Pre-rollout saves remain completion-only, and existing completed-result records are never rewritten. Missing lock/storage/random-ID capability disables new AB contribution rather than weakening identity. Detailed implementation sequence: `tasks/plans/resolved-at-bat-browser-lifecycle.md`.

## Caching and privacy

- Bootstrap/public page data may use safe revalidation.
- The fully materialized server-only public Daily puzzle is cached by puzzle date with a 300-second safety revalidation window; successful authenticated admin saves invalidate that cache.
- The materialized cache may contain server-only answer IDs and hint data required for authorized resolution, but it is never itself a public response and does not alter bootstrap serialization rules.
- Hint-bundle, one-hint, and resolution responses are `private, no-store`; resolution responses themselves are never cached.
- Resolution responses may expose only the diagnostic `daily-resolve` timing duration above in addition to their normal sanitized body/headers.
- Logs must not include signing secrets, answer IDs, credentials, or full reveals.
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

## Private admin attempt report

`GET /admin/daily/attempts` renders the private anonymous-attempt table; `GET /admin/daily/attempts/export` downloads the same filtered page as CSV. Both require existing Daily admin Basic credentials before any DB read. CSV returns a 401 Basic challenge for unauthorized callers, 400 for invalid filters, 503 for unavailable reports, and `private, no-store` / `nosniff` on every response. The page is force-dynamic and redirects unauthorized callers to `/admin/auth`; report failures expose no raw provider error.

Filters: `date` defaults to the current Pacific day; optional `puzzleId` selects one exact edition (blank defaults to the stored editorial lineup); `ruleset` is points-v3 or points-v4, default v4. `abAfter` and `completedAfter` are independent opaque attempt/submission ID cursors produced by the report links. Reads scan up to 50 AB attempts and 50 completions per page, join only matching IDs and include completion-only rows separately. The CSV exports this bounded page only, with quoted/formula-neutralized cells, per-slot source and UTC receipt time; the grid displays Eastern receipt times. No named identity, mutation, hidden answer or aggregate recalculation is part of this endpoint.

## Deferred APIs

Completed-result aggregate/percentile reads, accounts, authoritative streaks/leaderboards, and head-to-head/social APIs require separate decisions. Browser result submission/retry is a client workflow over the completed-game POST endpoint, not a separate public API.


## Authenticated archive-beta publication completion

Public archive composition lives at `/archive` (metadata-only recent issued catalog) and `/archive/N` (issued beta bootstrap). Pre-epoch, current/future, malformed-number and missing-record requests fail closed; rendering never issues or regenerates a row. Existing `/api/daily/hints`, hint and resolution transports verify the signed progression token before dispatching beta IDs to the issued-puzzle runtime. That runtime independently verifies exact puzzle ID/date and retains current redaction, hint authorization and scoring. No answer IDs or future-batter hint values enter bootstrap props. Browser saves include exact beta puzzle/ruleset identity; archive gameplay does not submit to current-Daily result APIs or read current-Daily comparison populations. No new API endpoint, schema or permanent launch configuration is introduced.

`POST /admin/daily/lifecycle` retains existing Basic administrator authentication and same-origin mutation admission. For `action=publish` and dates in the explicitly configured disposable beta epoch, it commits the portable editorial publication first, then invokes immutable archive-beta issuance and verifies exact persisted content by date and number. Future published dates may be frozen; this operation exposes no public archive content or future availability.

A successful operation returns a metadata-only 303 redirect with `private, no-store`. A failed archive copy/read-back after publication returns sanitized 503 with a Verify archive copy retry instruction. Retrying the publish operation for an already published beta-eligible record skips the editorial transition and preserves its revision/audit fields, while immutable issuance preserves the first timestamp/content or rejects a conflict. Scheduling and pre-epoch publication retain the existing lifecycle path. Beta-eligible archiving verifies the copy before retiring the published retry path; a failed verification keeps the lineup published. Immutable-content conflict is a sanitized 409 requiring editorial review, not a retryable 503. This is a two-write completion operation, not a distributed transaction; publication is not rolled back after archive failure.

Explicit `POST /admin/daily/archive-beta/issue` remains separately authenticated and restricted to the beta start through the current Pacific date. Both operations share the same server-only issuance/read-back composition; neither serializes answer IDs, clues or provider error payloads. Public route renders never issue puzzles.

## Completed-day archive rollover

`POST /admin/daily/archive-beta/rollover` accepts existing Basic administrator authorization or the existing `DAILY_CHATOPS_TOKEN` Bearer principal. Cross-origin requests are rejected and authorization completes before repository access. No date, lineup, or cutoff is supplied by the caller: the server determines completed Pacific dates from the explicit beta epoch. It returns metadata-only cutoff/created/preserved/remaining counts and sanitized per-date failure categories, with `private, no-store`; complete runs return 200 and incomplete/unavailable runs 503. Missing/incorrect credentials fail closed with 401/503. Publication and immutable copy/read-back are separate writes; failed copies retry against committed publication without another audit revision. Existing copies/timestamps are retained without clue regeneration. Public catalog/gameplay GETs remain read-only. Scheduler activation belongs to the following private-transport migration, not this endpoint release.
