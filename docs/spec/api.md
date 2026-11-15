Warning: truncated output (original token count: 28108)
Total output lines: 755

# Daily web API specification

Status: Living source of truth  
Last updated: 2026-10-15

Daily routes are thin Next.js adapters over canonical baseball data, engine rules, and portable Daily logic. Answer-integrity rationale is in `docs/decisions/0001-daily-answer-integrity.md`.

## General rules

Every route must validate input, return sanitized data, keep rules in their owning packages, avoid per-action persistence, and never reflect secrets or hidden answer data in errors. Public search returns canonical player IDs. Daily resolution may compare a syntactically canonical submitted ID directly with the server-only canonical answer ID; legacy/noncanonical IDs cross the canonical redirect boundary before comparison.

## Default-disabled anonymous Custom creator HTTP boundary (PR #440)

`POST /api/custom-lineup/create` is a staged, **default-OFF** Web-only issuer
for `{canonicalPlayerIds, title}`: an ordered selection of 1–10 canonical baseball player IDs and a required 3–60-character sanitized human title. It returns
an opaque v2 puzzle ID, a one-time random owner management code in a private no-store JSON body, and a scoped HttpOnly signed creator
preview/exclusion cookie, not roster identities, hints, signed answer material
or public indexed metadata. The title is normalized/validated before reserving creation quota, and is persisted with the immutable issued challenge in its same row insert. A random 32-byte owner management capability is minted only for the anonymous issuer; its SHA-256 digest is persisted in that same insert, and its plaintext is returned once only to the creator. The friend link and creator-preview cookie are never management credentials. Publishing and owner verification are not enabled. The body is UTF-8 JSON-only, 4,096-byte bounded,
exact-same-origin with no query parameters. A 1–10 player selection is validated
by the existing immutable v2 issuing service; there is no parallel game rule.
Both server-only flags `CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED=true` and
`CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED=true` are required; otherwise
it responds with a generic 404 before any budget/issuance request.

When intentionally activated after separate approval, this route requires a
verified single Vercel ingress client IP, separate server-only budget HMAC
secret, and service-role-only Supabase atomic reservation before issuing a
challenge. The two-argument budget RPC verifies the HMAC's claimed UTC day
against the DB's UTC day **after** the advisory lock; one zero-quota-cost
server-derived rehash/retry is allowed for clock skew/midnight. Absent or
untrusted ingress, key, database, or inconsistent response fails closed
with sanitized 503. Quota denials are 429 with Retry-After; the 10/10-minute
client budget and 1,000/day global cap remain database-authoritative.
Caught unexpected 503 creation failures emit a sanitized server-side JSON diagnostic
(`event: custom_lineup_creation_unavailable`, `stage: signing|budget|issuance`,
`status: 503`) for launch triage. The event never contains an IP address,
request body, owner capability, player IDs, error message/stack or hidden clues.
Expected 4xx responses, valid quota denial and disabled-route requests stay silent.
The public 503 body and no-store headers do not change.

The staged no-sign-in creator UI treats an unexpected HTTP 5xx, transport
failure, or unreadable successful response as **ambiguous issuance**: the
request may have committed even though the creator did not receive the owner
code. The client preserves its draft, makes no automatic replay, and explains
that a manual retry is a new immutable issuance consuming another creation
attempt; it does not recover the prior owner code. Explicit known validation
and quota failures (400, 422, 429) retain their specific messages. The
server's immutable-conflict 409 is a definitive non-issuance and retains
the existing generic failure message. This is
client feedback only, not an idempotency guarantee or a new server response.
The owner approved this Phase 1 behavior in #471: an explicit retry after an ambiguous response may create another private immutable challenge, consume another quota admission, and mint a distinct one-time owner capability; the original capability cannot be recovered. No idempotency or owner-code recovery is in scope. #471 remains open only for credential-backed isolated-QA browser evidence of committed response loss, no automatic duplicate, and the disclosed manual retry.

This is staging, not permission to activate anonymous creation. Newly issued anonymous Custom Lineups now require the bounded name under the shared contract (#442) and store it in the private issued table (#444). The actual creator UI (#441), safe title read/view, browser/mobile QA, and creator management/public publishing remain separate.
Do not enable this route without naming, WAF/privacy review, hosted browser
and mobile QA and controlled release approval. The legacy admin creator is
unchanged and existing v1 games remain compatible.

## Disabled-by-default Custom Lineup v2 gameplay transport (PR #414)

Four `POST /api/custom-lineup/challenges/{puzzleId}/attempt/{bootstrap|hint|resolve|submit}` transports are staged behind server-only `CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED=true`. The default/unset/other values respond `404 {"error":"not_found"}` **before** challenge validation, cookie inspection, storage or server service access. The gameplay transport itself does not issue challenges; a separate default-OFF anonymous creator route is staged above. No public Custom Lineup UI or flag activation occurs in this stage.

Every enabled POST requires exact same-origin `Origin` (including rejecting a missing Origin: 403), no query string (400), v2-only opaque challenge UUID, and `Cache-Control: private, no-store; Vary: Cookie`. Nonempty `bootstrap` or `submit` body is rejected (400). JSON hint/resolve request bodies are UTF-8 byte-bounded by the existing Custom Nine reader (4096 bytes) and strict keyed-shape validators: hint accepts only `{progressionToken}`, resolve accepts only `{progressionToken,submittedPlayerId}` with canonical player ID or `{progressionToken,giveUp:true}`. The token is signed by the separate v2 domain. Neither an attempt ID nor player ID from a browser can be used as a result authority.

The bootstrap service returns sanitized `attemptMode:'reserved'` with redacted current-batter hints and completed-at-bat outcomes, setting a scoped HttpOnly browser cookie only on first reservation; `creator_preview` is noncompetitive. Already completed games return `attemptMode:'completed'` and saved outcomes/timestamp/revision **without** a live progression token. Hints produce only one successfully CAS-committed hint/token/revision. **All** guesses, including correct, incorrect, third strike and give-up, are sent to the **same** v2 atomic guess service; failed-CAS requests cannot reveal a tested answer. Terminal results expose only the canonical reveal view-model whitelist after successful mutation, plus next-batter redacted hint bundle when applicable. Bodyless submit calls the installed service-role-only atomic completed admission service, returning only `{status:'created'|'existing'}` (201/200). Errors return sanitized 400/403/404/409/503. The legacy Daily/Classic and Custom Nine v1 routes are untouched.

## Guarded Custom Nine comparison read (disabled by default)

`GET /api/custom-nine/challenges/{puzzleId}/attempt/comparison` is a server-only, challenge-scoped read of **accepted** Custom Nine points-v4 results. It returns 404 without a service/database call unless both server-only `CUSTOM_NINE_COMPARISON_READ_ENABLED=true` and `CUSTOM_NINE_RESULT_SUBMISSION_ENABLED=true` are explicitly configured. These are **not** activated by this code stage.

When separately activated, the URL supplies only an immutable issued challenge ID. No query parameters, arbitrary excluded submission ID, scores, clue metadata, or browser-chosen result selection are permitted (400); foreign Origin/cross-site fetch metadata is rejected (403). The reader verifies signed noncreator challenge-scoped attempt cookie, completed private ledger and exact admitted first-attempt result before any peer read. Missing/creator/invalid/unadmitted credentials return 403, incomplete attempts 409, unknown challenge 404, provider failures 503, with generic bodies.

Success body: `{schemaVersion:1, rulesetVersion:'points-v4', completed:{completedGameCount,averageTotalPoints,scoreHistogram}, atBats:[{pitchNumber,resolvedAtBatCount,averagePoints,scoreHistogram}]}` with nine ABs. Only aggregate histograms, counts and averages are returned, never answer, identity, terminal facts, browser credentials, result UUID or hidden clues. Every response uses `Cache-Control: private, no-store` and `Vary: Cookie`. Score rules and histogram calculations stay with the existing portable Daily/engine-owned implementation. The endpoint does not accept or trigger score submission.

## Guarded Custom Nine completed-result submission (disabled by default)

`POST /api/custom-nine/challenges/{puzzleId}/attempt/submit` is a **bodyless, same-origin, signed-cookie-only** transport for the existing private Custom Nine completed-result admission service. It is dormant unless the server-only `CUSTOM_NINE_RESULT_SUBMISSION_ENABLED` setting is exactly `true`; absent, disabled and nonmatching values all return `404 {"error":"not_found"}` before any database/service work. Deploying the route **does not authorize switching it on**. No Vercel setting is changed as part of this stage.

If a future separately approved environment enables it, the endpoint requires an explicit same-site browser Origin equal to the request origin (missing or foreign Origin: 403) and rejects every nonempty request body (400). No submitted score, chosen submission/attempt ID, token, receipt, guess, hint depth or JSON is accepted. Only the URL puzzle ID and retained HttpOnly cookie go to `createServerCustomNineCompletedAdmissionService`. This service rejects verified creators, absent/invalid/duplicate creator/attempt credentials and cross-challenge attempts; requires one server-monotonic, signed, completed nine-fact ledger and immutable issued challenge; recomputes points-v4 summary and all nine awards in `packages/engine`. The service-role-only database transaction derives the immutable result ID from the server-created attempt and atomically stores the completion plus nine scored at-bats. Exact retries return the existing winner.

A successful first write responds 201 `{"status":"created"}`, and an exact retry 200 `{"status":"existing"}`. No private attempt UUID, score details, identity, unrevealed hints or answer enters the response. Unknown challenge is 404, bad cookie/creator 403, unfinished attempt 409 `{"error":"attempt_incomplete"}`, and unexpected private/provider corruption 503 `{"error":"submission_unavailable"}`. Every response is `Cache-Control: private, no-store`. This is **not a public Custom competitive rollout**: the server feature flag stays off, comparison readers/UI/creation safeguards are separate, and cookies/new devices and noncompetitive stateless Custom play prevent unique-human or cheat-proof first-play guarantees.

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

## Custom Nine nonterminal wrong-guess persistence (private, staged)

The Web server-only `createServerCustomNineIncorrectGuessService` composes existing canonical Custom guess resolution with signed active-token validation, the challenge/creator/attempt-cookie checks and private attempt-ledger CAS. For an active signed guess at zero or one prior strikes, an **incorrect** engine result increments only strike count by one, verifies a separately signed successor with unchanged pitch, hint depth and out count, and commits it under the previous token and revision. Replay/race conflicts return only a private conflict; correct guesses or third-strike terminal actions return a private `terminal_pending` marker without mutation. Persisted at-bat terminal facts do not change.

There is **no public incorrect-guess POST**: such a partial endpoint would disclose whether a proposed answer was correct while refusing to commit terminal outcomes. No client or scoring/result route is wired to this seam. The follow-up must implement the full correct/incorrect/third-strike/Give Up transaction and then expose an appropriately protected single stateful route. Existing stateless Custom endpoints remain legacy/noncompetitive.

## Custom Nine scored resolution POST (staged)

`POST /api/custom-nine/challenges/{puzzleId}/attempt/resolve` is a **single combined** scored guess and Give Up endpoint, separate from the older stateless `POST /resolve`. It requires same-origin bounded JSON with exactly `progressionToken` and either `submittedPlayerId` (nonblank bounded canonical guess) or `giveUp: true`. No browser-selected score, hint count, attempt ID or terminal facts can be accepted. A guess first uses the private nonterminal incorrect service (#372). That service persists a first/second incorrect strike via signed one-step CAS, returning `kind:"incorrect"`, `strikeCount`, `progressionToken` and committed `revision`. If the private service returns `terminal_pending`, the server must invoke the separately verified **terminal-only** resolver before returning any answer. An explicit Give Up invokes only that terminal path.

The terminal-only service checks exact issued-challenge identity, signed creator/attempt cookie, Custom-only signed predecessor, active stored token and next terminal pitch; obtains the engine-calculated frozen-puzzle resolution; verifies a signed successor (one pitch advance, strike/hint reset, capped K out increment, ninth completed) and HMAC terminal receipt binding the precise predecessor/successor digests, ordered initials, ruleset-correct outcome, revealed hint and wrong-guess counts, and resolution (correct/strikeout/give_up). It atomically appends the single normalized at-bat fact and updates revision/token/status. Success returns `kind:"terminal"`, `result`, the server-authorized terminal `reveal`, newly persisted `progressionToken`, committed `revision`, and a next-batter hint bundle stripped of future hints and pre-signed checkpoints. A losing/stale attempt receives 409 with **no** answer or successor. Ninth terminal completion has no next hint bundle and future attempts cannot change it.

Missing/invalid creator or attempt cookie 403; malformed signed progression 400; unknown challenge 404; stale/completed 409; sanitized provider or invalid server-transition error 503; all responses `Cache-Control: private, no-store`. Competitive Custom result rows and comparison APIs remain **disabled**. The old stateless Custom routes remain noncompetitive, and anonymous cookie resets/new devices can bypass continuity. Separate result-admission and creator-exclusion review is still required before public scores.

## Custom Nine opt-in stateful hint reveal (staged)

A new, separate `POST /api/custom-nine/challenges/{puzzleId}/attempt/hint` accepts exactly `{"progressionToken":"<prior signed token>"}` in a bounded JSON body. The server inspects both exact-challenge signed creator and attempt cookies, rejects any invalid/missing/creator identity from this scored attempt route (403), and verifies Custom-domain HMAC, challenge identity, points-v4, noncalendar Custom sentinel date and unfinished reveal depth. It then checks that the presented token equals the private attempt ledger's exact active saved token, invokes the existing server-frozen Custom hint resolver, independently checks the signed successor increments only revealCount by one, and commits via a conditional revision/current-token/attempt-ID UPDATE.

A **single winner** receives HTTP 200 containing the one `hint`, its signed successor `progressionToken` and committed `revision`. Replays, races and stale presented tokens are HTTP 409 `conflict` with **no hint**. Unknown challenges are 404, malformed/forged progression 400, completed attempts 409, and faults sanitized 503. Same-origin restriction and `Cache-Control: private, no-store` apply. No browser-supplied score, hint depth or at-bat fact can be committed.

On the opt-in `/attempt/bootstrap` path, reserved noncreator sessions now receive `hintBundle.hints` truncated to slots already revealed by their authoritative signed state, with `hintBundle.checkpoints: []`; this prevents that specific path from leaking the four unrevealed hint values or pre-signed reveal-depth branches. Verified creators remain preview-only and never contribute. Previous **stateless** Custom GET/hints/hint/resolve paths retain their existing behavior and are deliberately **not competitive evidence**. Their continued visibility means hint-use honesty is not globally provable; no result writes are enabled by this stage.

**Headless Custom Nine browser integration (staged):** `apps/web/app/customNineGameplayTransport.ts` is a checked client of the existing POST attempt bootstrap, hint and resolve routes below. It uses challenge-scoped same-origin credentials, sends no browser-chosen attempt ID, distinguishes `reserved` from `creator_preview`, validates resumed public facts and only currently authorized hints, and maps completed-versus-stale 409 responses to distinct nonauthoritative client errors. Network-ambiguous action outcomes must be reconciled by a fresh server bootstrap rather than optimistic local replay. It adds no API endpoint, scoring rule, persisted field or competition activation. See `tasks/plans/custom-nine-browser-transport.md`.

## Custom Nine opt-in browser attempt bootstrap (staged)

`POST /api/custom-nine/challenges/{puzzleId}/attempt/bootstrap` is a new **same-origin bodyless reservation** route. Existing stateless `GET /bootstrap`, `POST /hint`, `POST /hints` and `POST /resolve` remain unchanged. The additional POST validates the exact challenge and checks separate creator/attempt cookies before any new persisted attempt. Duplicate, malformed or forged cookie of either type causes HTTP 403. A valid creator marker receives opening signed frozen hints and `attemptMode: "creator_preview"`, without a Set-Cookie or database attempt. An unmarked browser receives a cryptographically random 32-byte nonce and domain-separated HMAC in a host-only, HttpOnly, SameSite Strict cookie under the exact challenge API path (Secure for HTTPS, one-year Max-Age). Only a domain-separated SHA-256 hex digest is the private ledger browser key. The signed bearer credential is never echoed in the JSON body.

Reserved success additionally returns `attemptProgress: {strikeCount, completedAtBats}` from the existing server-saved, Custom-signed current token and ordered terminal facts. `strikeCount` is only current-batter wrong guesses (0–2); `completedAtBats` contains the already-terminal public result facts (slot, initials, result, hints revealed, wrong guesses, resolution), not answer IDs or future clues. The server verifies the challenge/ruleset/date, current pitch/reveal and capped out state against saved facts and current authorized bundle. Inconsistent or forged private continuation fails closed. This projection is omitted for `creator_preview`; it does not create or advance any attempt.

Only after successful `getOrCreate` insert into `custom_nine_attempt_states` does the response include Set-Cookie and `attemptMode: "reserved"`. The same retained signed cookie performs an exact ledger read to resume the original current signed progression token and matching active-batter frozen hint bundle, not a new opening. Valid cookies whose row is missing return 403; completed attempts return 409. Unknown/malformed challenges return 404; cross-origin requests 403; a nonempty request body 400; store/signing or corrupt continuation errors 503. All responses use private no-store and never return player IDs, future hints or private attempt UUIDs. This endpoint does **not** record hints/guesses, award points or submit completed/AB results.

**Security limitation:** This opt-in browser reservation is not unique-human or honest-first-play proof: existing Custom stateless routes remain accessible and replayable before this POST; cookie deletion and device changes allow new credentials. Future stateful Custom hint/guess/resolve and result admission must reject those older stateless branches before competitive contributions are enabled.

## Custom Nine signed current-batter hints (staged)

`POST /api/custom-nine/challenges/{puzzleId}/hints` restores the authorized active batter's frozen four-hint bundle and remaining signed reveal-depth checkpoints; `POST /api/custom-nine/challenges/{puzzleId}/hint` returns **one next hint** and the signed successor token. Both accept **only** `{ "progressionToken": "opaque-signed-token" }` as a JSON object (max 4,096 request bytes), and neither allows guessing, batter advancement, answer reveal, result contribution or browser UI access. The client can also advance locally with the signed checkpoints already present in the bundle, identical to existing Daily Nine.

Both endpoints check the URL challenge ID, then cryptographically verify the token with the **Custom-only HMAC signing domain** and require claims bound to exactly that ID, the non-calendar Custom sentinel date, an incomplete session and the immutable `points-v4` ruleset **before** reading the private issued challenge. They load and validate the server's frozen clue snapshot and reuse Daily runtime hint selection/checkpoint issuance; they do not recompute hints from live facts. Only the token-authorized batter's hint values can be returned. The full private challenge and canonical names/answer IDs are never serialized.

Malformed/forged/cross-domain/cross-challenge/cross-ruleset/completed tokens return `400 { "error": "invalid_progression" }`, invalid/unknown challenge IDs return `404 { "error": "not_found" }` and unavailable configuration/provider/private records return sanitized `503 { "error": "session_unavailable" }`. Every status, including errors, is `Cache-Control: private, no-store`. Tokens are stateless and replayable (the existing anonymous-game limitation); these endpoints never write to Supabase. Custom results, creator exclusion, resolution and public creator UI remain later stages.

## Custom Nine signed guess resolution (staged)

`POST /api/custom-nine/challenges/{puzzleId}/resolve` accepts a bounded (4,096-byte) JSON object with **exactly** a signed `progressionToken` and one action: `submittedPlayerId` (nonempty string, maximum 200 characters) **or** `giveUp: true`. Extra client claims, simultaneous actions, arbitrary score/out counts and other fields are rejected. It uses the **Custom Nine-only** signature domain from opening bootstrap and exact versioned challenge ID, fixed sentinel date, immutable `points-v4` ruleset and incomplete signed session; token checks occur before private Supabase reads. Universal, Classic, Archive and other Custom challenge tokens cannot authorize resolution.

The server reads the immutable, private issued challenge and constructs the same frozen nine-batter puzzle used by bootstrap/hint hydration. It delegates guesses, strikes, score-policy facts, Give Up, next-batter advancement and ninth-batter completion to the **existing Daily runtime**. Ordinary canonical IDs compare directly with the current frozen answer ID; legacy IDs use the existing canonical redirect boundary. Incorrect guesses return `{ result, reveal: null, progressionToken, hintBundle }` with refreshed current-batter state. A correct guess, third strike or Give Up includes a canonical reveal of the **terminally resolved current batter only** and a Custom-signed successor token. `hintBundle` includes the…13108 tokens truncated…**. The explicit revealHint command remains the sole
transport of the next clue and its next signed progression token. Each
incorrect guess preserves the same partial visibility; an at-bat completion
never preloads the next batter's clue. The private server may still construct
complete hint bundles internally for authoritative resolution.

The legacy-bundle transport remains the default for the public Primary Daily.
The source-staged secondary exact-ID runtime now **explicitly opts into that
same bundle behavior**, with only its current batter's authorized four clues
and signed reveal-depth checkpoints. The optional on-demand projection remains
available to the shared runtime but is not used by official edition practice.
Pacific date admission, exact-ID isolation and physical device QA still apply.

The private exact-ID adapter binds a runtime to one frozen publication and the issued points-v4 ruleset. Its reader must enforce Pacific release eligibility and return the exact materialized puzzle or null. Signed continuation tokens for another edition or ruleset fail before publication lookup. Bootstrap, continuation and terminal play use the shared Daily runtime with the current active batter's complete authorized hint bundle. Competitive admission is gated separately by #657.

## Default-OFF private exact-ID Daily server runtime composition

The web server can compose a private official edition runtime from the existing immutable release-aware reader and the shared exact-ID points-v4 current-batter hint-bundle runtime. The composition factory validates the canonical daily-ed-v1 occurrence ID and requires the exact server-only setting OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED=true **before** obtaining a service-role client or canonical runtime. Every gameplay read re-evaluates release eligibility using the server Pacific clock; future and missing publications yield no puzzle.

This source-staged composition is used by the separately default-OFF exact-ID HTTP and server-rendered practice routes, but is not publicly activated. Even with the private factory flag on, the existing fail-closed secondary score and comparison admission remain active. The separately verified edition-bound signed-attempt provenance in issue #657 is required before public competitive starts. The existing primary Daily, Classic and archive-beta runtime selection and their legacy token/hint contracts remain unchanged.

### Source-staged exact-ID edition gameplay HTTP transport (default OFF)

The route `/api/daily/editions/:puzzleId/:action` is gated by an additional exact server setting `OFFICIAL_DAILY_EDITION_HTTP_ENABLED=true` **and** the private runtime's independent `OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED=true` gate. Both default OFF. Only `GET .../bootstrap?date=YYYY-MM-DD` and strict JSON `POST .../hint`, `POST .../hints`, and `POST .../resolve` are recognized. They compose the immutable-ID, release-aware server runtime, return `private, no-store` data, and reject invalid/unknown actions and payloads. Bootstrap, valid resume and next-pitch responses include exactly four **current-batter** hints and remaining signed reveal-depth checkpoints; the shared browser game reveals each locally without a per-hint POST. The source-compatible single-hint POST remains supported, but the official edition practice UI does not invoke it. No future-batter clue, answer identity or privileged field is serialized.

This HTTP transport is source-only and not an approved player-facing activation. In particular, its `resolve` returns portable at-bat outcomes but makes **no competitive writes, attempt reservation, leaderboard projection or eligibility decision**. Existing result writers explicitly reject all `daily-ed-v1-` IDs pending issue #657's independently verified signed per-edition attempt/score admission. The new HTTP gate must remain OFF until the complete A2/A3 integration, independent review, QA/physical-device verification and explicit production release decision. Primary Daily/Classic/Archive routes are unchanged.

### Source-only browser adapter for exact-ID edition requests

The browser-only `createOfficialDailyEditionHttpTransport(puzzleId)` binds the future client to one validated immutable `daily-ed-v1-` identity. It addresses only the separately gated edition `bootstrap`, `hint`, `hints` and `resolve` endpoints; it never routes a secondary puzzle to legacy `/api/daily/resolve`, exposes score-writing methods or silently falls back to primary Daily. The source-staged bootstrap parser verifies the exact returned puzzle ID/date, points-v4 ruleset, nine answer-free public pitch shells, and the four authorized **current-batter** hints plus ordered signed checkpoints. Resume and resolution responses must contain exactly four current-pitch hints and checkpoints for depths after the verified revealed count; malformed or additional fields fail closed. Server tokens and eligibility remain authoritative on the server, not browser-verified. The shared `DailyInningGame` consumes this browser adapter in officialEditionPractice mode behind the three default-OFF settings. This is implemented but not publicly activated; the signed secondary result-admission gate (#657) remains mandatory before competitive usage.

The exact-ID browser transport independently validates nested public hint and statistics configuration and each single-hint envelope before passing data to the UI. Its default GET and POST transports preserve sanitized typed outcomes: `not_found` for 404, `invalid_request` for other 4xx, `unavailable` for 5xx/network failures, and `invalid_response` for malformed successful JSON. Underlying provider/token diagnostics are not surfaced. These are browser transport error categories, not competitive admission decisions.

The browser transport additionally validates the discriminator-specific at-bat result and the post-terminal canonical public reveal projection (stat lines, seasons, career peaks and known fields). Incorrect guesses must have a null player reveal. Unexpected nested answer-bearing fields are rejected rather than forwarded. This does not validate the server's signed competitive eligibility; issue #657 remains the authority for that later integration.

### Source-staged shared Daily UI for exact-ID practice

The existing Daily Nine component can be rendered with `officialEditionPractice` for an immutable `daily-ed-v1-` ID. In this mode resolution and saved-game restoration use edition-bound server endpoints rather than legacy primary endpoints, while each current-batter Hint tap uses the existing browser-local `revealNextHintFromBundle` and a signed checkpoint without any per-hint network request. Secondary-edition leaderboard/comparison reads and score submissions remain suppressed. Local saves and share links use the edition ID. The separate server-rendered practice route and default-OFF activation gates are implemented, but are not publicly enabled. No competitive admission, database writes, or new scoring rules are introduced; primary Daily and Classic keep their previous behavior.

### Default-OFF official Daily practice route

`/daily/editions/:puzzleId?date=YYYY-MM-DD` is a private, no-index, noncompetitive acceptance page using the existing Daily Nine UI. It requires all three exact server settings `OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED=true`, `OFFICIAL_DAILY_EDITION_HTTP_ENABLED=true`, and `OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED=true`, each OFF by default. It rejects invalid IDs, malformed dates, query extras, unreleased/future editions before rendering an answer-free bootstrap. Gameplay and local saves remain edition-bound; results and comparison populations are not admitted. This page is staged for hosted QA only, not enabled on production or approved for public activation.

### Browser-safe edition identity dependency

The exact-ID browser transport resolves its immutable occurrence-ID and strict real-date validators through the narrow `@initial-baseball/daily/official-edition-identity` export, not the `@initial-baseball/daily` barrel. That isolated module has no selection, clue snapshot, canonical player-data or server imports, preventing browser chunk inclusion of private player catalogs. The original Daily private issuer exports delegate to precisely the same validators; no published identity format or existing ID/date validation changes. The production hidden-answer bundle QA must pass before this is mergeable.

The browser bootstrap decoder also rejects non-positive or unsafe puzzle numbers and metadata statuses other than released `published` / `archived`. Metadata scalar validation occurs before any payload reaches the shared gameplay UI; objects containing answer data are never accepted as number or status fields.

### Server-rendered edition bootstrap boundary

The gated official edition practice page reuses the exact strict public bootstrap decoder before passing any payload into the shared client-side Daily game. Private clue-layout fields, additional player identities, invalid status/number fields and **future-batter** hint/checkpoint fields are rejected at the React server-component boundary; signed current-batter checkpoints are permitted. Tests assert that malicious bootstrap fixtures never reach the `DailyInningGame` client props. This preserves the hidden-answer invariant for initial HTML/RSC, not merely subsequent HTTP responses.

The strict `validateOfficialDailyEditionBootstrap` schema is exported for reuse at the Next.js server-to-client render boundary. A server-rendered official practice page must validate the full public puzzle, hint configurations, nine public pitches, signed progression token, and only the authorized **current-batter** four-hint bundle/checkpoints **before** passing the bootstrap as serialized client props. Unexpected nested private fields fail closed rather than being forwarded.


## Official secondary Daily practice-only results and comparison presentation (#583, staged)

Secondary practice sessions use the same shared Daily Nine at-bat/game engine and preserve each authoritative personal at-bat and cumulative points result. Because these sessions are noncompetitive, the read adapters intentionally never query Daily AVG/BEAT/percentile populations. The React game and completed-scorecard presentation must enforce the same policy: suppress all comparison loading tiles, peer average/percentile tracks, expandable score histograms, leaderboard, and chart disclosures rather than showing an indefinite loading state. The private practice UI still supports spoiler-aware reveal of already completed players and the standard personal score/share flow; primary Daily, Classic and Archive-beta competitive comparisons are unchanged. The official edition practice route remains strictly default OFF and is not publicly activated without separate complete hosted/device and answer-integrity acceptance.

The source-stage same-date edition storage regression additionally asserts that exactly identified secondary editions never share browser saves, reset boundaries or gameplay ownership keys with one another, current primary, Classic or Archive beta. Both retained and unknown future `daily-ed-*` IDs remain excluded from competitive result collection. The unit test does not substitute for real multi-tab Safari/Android acceptance.

## Private official-edition date catalog (staged, no public route)

The web server now has a private metadata-only date catalog reader for
immutable official Daily publications. It accepts a valid Pacific game
date and pages by increasing editionNumber, returning up to 100 records
per request and an edition-number cursor if more results exist. It does
not impose a maximum number of editions per date: consumers must continue
through the pages for complete archive/date discovery.

The database projection is restricted to puzzle_id, puzzle_date,
puzzle_number, edition_key, edition_number, title, schema_version and
ruleset_version. It never reads frozen clue snapshots, canonical player
IDs or hint values. Each row is validated against the existing Daily
identity, date/number, slug, title and ruleset rules. Provider failures
and malformed metadata are sanitized; the reader fails closed rather
than returning partially verified pages. Future Pacific dates return
empty results without querying the database.

This is only a server-private discovery adapter: it does not activate
public browsing, a share link, editor access, public gameplay, Archive
routing, or secondary edition score admission. The legacy primary is
not included or changed. Public date/edition browsing and full
archive grouping require separately reviewed UI and server admission;
the immutable official publication store and rollout flags remain
release-gated.

The private cross-date official Archive catalog groups metadata for completed Pacific dates only (strictly before the current Pacific game date), descending by date and ascending by edition number. Publication titles are validated against the shared title parser, preserving parser-valid stored text (including repeated interior spaces) instead of rejecting an entire catalog page; invalid titles still fail closed. Its cursor contains the last returned date and edition number so a single date may span pages. The public Archive must also retain historical numbered entries and their device-local results. This private query does not issue play links or change the public Archive.

### Default-off official Daily Archive section (A4, source staged)

The existing public `/archive` page continues serving legacy Archive beta unchanged when the new feature is OFF. A separately gated official edition section may read only immutable past-Pacific-day publication metadata using the server-only, keyset-paginated catalog from #571. It displays each occurrence as `YYYY-MM-DD – Puzzle title` with a secondary exact-ID practice link only behind the four existing exact-true Archive/HTTP/runtime/UI gates; hosted/browser acceptance and release approval are separate; a date may have any number of editions. Its pagination cursor is a validated date/positive edition number pair and never a title or roster hash. The section requires four exact server flags, all default OFF: `OFFICIAL_DAILY_EDITION_ARCHIVE_ENABLED`, `OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED`, `OFFICIAL_DAILY_EDITION_HTTP_ENABLED`, and `OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED`. When any is OFF the official catalog is not touched; when the catalog fails, only a sanitized availability message renders, preserving historical Archive beta access. The public route does not expose frozen clue snapshots, server service keys, live/current-day editions, scores or comparison populations. This staging depends on the shared edition practice route (#583) and is **not a public-release authorization**; integrated/physical QA, the signed A3 admission gate (#566), independent reviews and rollout approval remain outstanding.

The public Archive view ignores unrelated URL tracking parameters while passing only present `afterDate` and `afterEdition` fields to its strict cursor decoder. Partial or malformed cursor fields still fail closed. Current/future-Pacific-day cursors are rejected **before** the privileged Supabase client is constructed, and the same authoritative clock value is passed to the catalog for its independent cutoff check.

## Private legacy-primary Daily publication catalog (#589, source only)

A server-only historical primary reader returns strictly verified publication metadata from the legacy daily_editorial_puzzles table for past-Pacific-day, already-published nine-player contract-v1 records. It selects only id, puzzle_date, puzzle_number, version, lineup_contract_version, status, published_at. It never selects selections, roster, player identities, hints, clues, actor details or results. It validates timestamps against the request clock, published status, immutable date/number consistency and descending unique dates. A 1–100 row (default 30) exclusive date cursor supports bounded pagination. Invalid input fails before private provider I/O; bad provider data fails closed without partial output.

The stored editorial ID (daily-YYYY-MM-DD-v1) is NOT necessarily the legacy gameplay/result puzzle ID, which can be roster-fingerprint or deterministic-fallback based. The reader deliberately exposes editorialRecordId, not puzzleId; it must not be linked or used for competitive admission without proving the historical authoritative identity and preserving existing results. This is source-only with no route, migration or activation, and not a completed unified Archive.

## Private primary-and-secondary Archive read-model merger (#589, source staged)

A private, source-only cross-catalog read model takes verified published primary editorial metadata and immutable secondary official edition metadata, orders by puzzle date descending and edition number ascending, and returns date-grouped pages with one exclusive (date, edition number) cursor. Each source fetches one more than the requested final page size (default 30, maximum 99), so a date containing hundreds of secondary editions can resume without duplicates, skipped dates or fixed edition limits. It checks date/number consistency, source identity collisions, malformed cursors and cross-source duplicate editions before exposing a page, redacting provider errors.

The original primary appears as Puzzle 1 **only when independently published editorial metadata exists**, with kind=legacy-primary and puzzleId=null. This is intentional: editorial record IDs are not authoritative gameplay/result IDs, and this merger does not make primary entries playable, admit scores, or silently combine accepted historical score populations. Secondary entries retain immutable exact IDs and titles. The merger is consumed by the shared server-only Archive composition and the existing default-OFF /archive route; the pure merger itself constructs no privileged client and is not A4 release approval. Preserve the original Archive beta as a separate series.

The read-model merger independently enforces each source's requested row limit and rejects secondary puzzle IDs repeated across different edition numbers, including the lookahead row. These are separate invariants from duplicate (date, edition) detection. The entire module is server-only to prevent client-side use of private source adapters.

## Unified historical official Archive date-grouped presentation (#589, staged)

The source-staged `UnifiedOfficialDailyArchiveSection` renders exactly one historical official Daily Archive from the verified primary/secondary metadata merge, grouped newest Pacific date first, with primary `Puzzle 1` and arbitrarily many immutable secondary editions. Published secondary entries now link to the existing exact-ID, date-bound practice route when the entire Archive is enabled; their title and immutable identity come only from verified publication metadata, never clue or score data. Legacy primary editorial publication records are intentionally **unlinked** with an explicit replay-unavailable label until the historical game ID, clue snapshot and result-population continuity are verified. Pagination uses the complete date/edition keyset in `afterDate`/`afterEdition` query fields, including continuation within one date. It renders titles as escaped text, has no direct Supabase access, score writes, hidden answers or comparison aggregates, and is now wired to the single existing default-OFF /archive route. The earlier #587 secondary-only renderer/test have been deleted, rather than shipping two competing official Archive sections.

## Unified official Daily Archive service-only composition (#589)

A distinct server-only unified-Archive reader composes the verified legacy published-primary catalog with immutable secondary publication metadata using **one Supabase service client and one Pacific request clock**. It reuses exactly the existing four default-OFF Archive/practice/HTTP/private-runtime flags and strict date/edition cursor decoding; OFF or invalid/current/future cursors cannot construct a privileged database client. Each catalog queries only publication metadata (not clue snapshots, player selections or score data); the merger keeps unverified historical primaries as unlinked `puzzleId:null` and exact secondary practice IDs intact. The existing default-OFF /archive route now consumes this service and the unified renderer. Historical primaries remain unlinked and beta remains a separate section on the same page. Errors are sanitized and preserve beta listings; route wiring alone is not public release approval. Neither this composition nor metadata discovery grants signed A3 scoring admission.

## Unified official Daily Archive route staging (#589)

The existing `/archive` page preserves the legacy Archive beta experience with all four new server gates OFF and performs zero unified publication access. When all gates are exact true, one official historical section groups verified published primary placeholders and secondary exact-ID/date practice links by Pacific date, using the same date/edition keyset for pages split within one date. It discards unrelated tracking query keys but rejects incomplete/malformed cursor data before privileged client construction. Legacy primary entries remain **unlinked**, marked unavailable for replay until their exact historical gameplay and scoring identity is independently established. The browser emits secondary practice URLs only within the four-gate Archive; the destination independently rechecks its three practice flags, exact ID, date and released publication. Hosted/physical acceptance remains a release gate. A private source error does not reflect secrets or block Archive beta. The former secondary-only renderer/test and private reader were removed; there is no second official Archive implementation. This staged route does not grant A3 score admission, apply a DB migration, or activate production flags.


### Practice-link prerequisite (Codex review, source-only)

Historical primary entries remain **non-clickable** until their exact gameplay ID and clue/result continuity are proven. The older Archive source removed secondary links because the practice route was absent, avoiding 404s. Following the source-integrated #608 exact-ID practice route, the new A4 navigation displays only validated secondary publication ID/date practice URLs while all Archive gates are active. The practice route remains independently gated and noncompetitive. Neither a local route test nor a READY Preview substitutes for protected hosted HTTP/physical-device acceptance and rollout approval. A historical primary additionally requires authoritative gameplay ID and clue/result continuity proof. No competitive score admission or public enablement follows from the Archive display.

## Private account My Creations keyset pagination (source-stage, default OFF)

The existing verified-account-only `GET /api/account/creations` returns a first page of up to 40 immutable Custom v2 challenges. The same endpoint accepts one optional `cursor` query parameter to request older entries; any other, duplicate, empty or malformed parameter fails closed with HTTP 404. All pages require the existing trusted Origin/Auth configuration and a server-verified nonanonymous creator account; missing authentication returns 401. The account ID is taken exclusively from the verified session and never from a query or a browser-supplied owner ID.

Response: `{ "creations": [{ "puzzleId", "title", "issuedAt" }], "nextCursor": string | null, "accountScope": string }`. The 64-character SHA-256 presentation marker is purpose-separated from other account uses and derived exclusively from the verified account UUID. It is not an authorization token or database filter and does not expose the UUID. Only safe, typed display metadata is projected from `custom_nine_issued_challenges`; hidden players, clue snapshots, owner capabilities, creator UUIDs and private result data are excluded. `nextCursor: null` means no older page. The server performs deterministic keyset traversal by `issued_at DESC, puzzle_id ASC`, matching the isolated-QA `custom_v2_verified_creator_recent_idx` index (the second key breaks same-timestamp ties); the two-key cursor avoids skipped or duplicated entries when multiple lineups share an issuance timestamp and avoids offset drift if a newer lineup is created. The cursor is bounded and carries only the previously returned timestamp and immutable puzzle ID. It is **not an authorization token**; every page rechecks the verified account and scopes the service-role SQL to that account and schema version 2. The reader fetches at most 41 projected rows to determine whether another 40-row page exists.

The private account UI appends older lineups on demand, validates response structure, deduplicates IDs defensively and provides a retry path for later-page failures. A newly expired account session clears its displayed list instead of retaining private metadata. If another tab switches accounts between page requests, a changed `accountScope` clears all retained rows and the cursor and asks the visitor to reload; pages from two accounts are never appended together. Source integration does not enable account creation, Custom publication, guest scores or production flags. Hosted authenticated QA, device acceptance and explicit launch authorization remain separate gates.


`scripts/qa-my-creations-pagination-browser.mjs` bundles the actual My Creations component and browser fetch path using the existing Vitest/Vite toolchain, then verifies eight mounted Chromium scenarios: 390px and 1280px viewports, unchanged or switched account scope, and empty or populated later pages. It uses a fresh browser context per case, an ephemeral loopback-only HTTP fixture and synthetic metadata; external requests and service workers are blocked. CI reuses the existing pinned QA-only Playwright installation. It does not sign in, use database credentials, exercise hosted ingress, capture screenshots/traces, or establish physical-device acceptance. A browser/fixture failure fails this verification.

### Current-day official Daily edition choice (A4, default OFF)

The existing Daily Nine at `/` remains the primary, guest-playable default and Classic remains separate. A source-staged, unindexed and server-rendered `/daily/editions` page lists only today's **Pacific-date** immutable official secondary publication metadata, with bounded 30-per-page keyset continuation by positive `afterEdition`. A primary `/` link is always shown. With the existing default-OFF practice route source integrated, each published secondary title links only to `/daily/editions/:immutableId?date=YYYY-MM-DD` when all four chooser flags are true; the destination separately checks exact identity, date and release. Each link is labeled practice-only and never claims competitive score submission. The page includes no unrevealed hints and admits no competitive scores. Positive protected-hosted and device navigation acceptance is still required before enabling any flag. Unrelated query tracking parameters are ignored; a continuation keyset carries both the positive edition cursor and its authoritative Pacific puzzle date. Partial, malformed or stale-across-midnight cursor pairs fail closed before any privileged client or catalog read, rather than accidentally skipping new-day editions. The page provides a no-secret first-page restart link on failure. Valid current-day cursors remain date-bound, and the existing catalog independently enforces identity, ordering, date, metadata schema and answer-free selection. The current home shows the chooser link only in the Daily Nine mode when all four exact server flags are `true`: `OFFICIAL_DAILY_EDITION_CHOICE_ENABLED`, `OFFICIAL_DAILY_EDITION_PRACTICE_UI_ENABLED`, `OFFICIAL_DAILY_EDITION_HTTP_ENABLED`, `OFFICIAL_DAILY_EDITION_PRIVATE_RUNTIME_ENABLED`. All remain default OFF. This is metadata navigation only, not signed A3 competitive admission; competitive score admission under #566, protected-hosted/mobile navigation acceptance, and production authorization remain separate release gates.

## Default-OFF practice navigation from the unified Archive and current-day chooser (A4)

The shared exact-ID official practice route is source-integrated in #608. The staged Archive and today-chooser UI now render published secondary metadata as encoded `/daily/editions/:puzzleId?date=:PacificDate` links **only inside their already gated section/page**: Archive requires its four exact-true flags, and the chooser requires its separate four exact-true flags. The destination independently requires its three practice/HTTP/private-runtime flags, validates the one-field date query and immutable `daily-ed-v1-UUID`, and uses the existing released-publication reader and signed practice gameplay. Archive links retain the historical immutable publication date; the current-day chooser uses its server-authoritative Pacific date. No answer, clue, result, user identity, score, or server secret is placed in the URL.

Legacy-primary entries remain plain-text/unlinked, because an editorial record ID is not an established historical gameplay/scoring ID. Issued secondary gameplay is **practice-only**: browser result collection, per-batter/completion competitive submissions, leaderboards and comparisons remain fail-closed under A3 issue #566. The existing beta Archive and primary Daily are unchanged. Source tests cover positive exact-ID/date links, default-OFF/no-private-I/O gates, escaping of editor titles, absent legacy-primary links, and existing route validation. This staging does **not** authorize production flags, official migrations, real account/Auth release, or public competition. Protected hosted QA and physical Safari/Android navigation and rollover remain required.
