# Daily web API specification

Status: Living source of truth  
Last updated: 2026-07-31

Daily routes are thin Next.js adapters over canonical baseball data, engine rules, and portable Daily logic. Answer-integrity rationale is in `docs/decisions/0001-daily-answer-integrity.md`.

## General rules

Every route must validate input, return sanitized data, resolve players by canonical/validated legacy ID, keep rules in their owning packages, avoid per-action persistence, and never reflect secrets or hidden answer data in errors.

## Public bootstrap

The Daily page receives:

- puzzle ID, number, date, status, hint configuration, and nine public initials;
- one opaque signed progression token for the first pitch;
- one authorized hint bundle for the first pitch only.

The active hint bundle contains:

- current pitch number and already revealed depth;
- all four current-batter hint labels/values;
- signed checkpoints for only the later reveal depths still available from the current claims.

It contains no answer ID, answer name, reveal record, or future-batter hint. New games use `points-v2`. Existing valid `points-v1` and `legacy-inning-v1` tokens retain their own policies.

## Canonical player search

### `GET /api/players/search`

Returns sanitized canonical candidates. Search aliases help retrieval but do not define reveal names. Genuine duplicate visible names receive career years only; teams and positions are not shown in public guess results.

## Active hint-bundle restoration

### `POST /api/daily/hints`

Request:

```json
{ "progressionToken": "opaque-signed-token" }
```

The server verifies the token and returns the bundle for exactly the authorized current pitch, strike count, and reveal depth.

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

Behavior:

- incorrect guess: no reveal, successor token with one additional strike, refreshed bundle for the same pitch and strike count;
- correct guess: current reveal, successor token, next-pitch bundle unless complete;
- third strike/Give Up: current reveal, recorded out, successor token, next-pitch bundle unless complete;
- final pitch or legacy three-out completion: completed token and `hintBundle: null`.

The browser does not submit pitch, hint depth, strike count, out count, or ruleset version independently. After a terminal response, the browser derives the awarded point display from the engine mapping for the verified ruleset and returned outcome. The route does not duplicate a client-trusted point value.

## Local Hint action

The active client performs no HTTP request on Hint click. It:

1. finds the next current-batter hint in the already authorized bundle;
2. reveals it locally;
3. replaces the current progression token with the matching signed checkpoint.

Scoring therefore still uses server-verifiable reveal depth on the later resolution request.

## Token contract

Claims contain only contract/ruleset version, puzzle ID/date, current pitch, reveal count, strike count, recorded outs, and completion. Tokens contain no hints or answers.

Valid pre-ruleset tokens normalize to `legacy-inning-v1`. Valid `points-v1` and `points-v2` claims round-trip without reinterpretation. Tokens are stateless and replayable; anonymous scoring is not tamper-proof.

## Browser persistence

The browser persists public gameplay state and the current opaque token, not the full authorized hint bundle. On ordinary transitions, the server response supplies the next bundle. On refresh, `/api/daily/hints` hydrates the bundle before the restored at-bat becomes interactive.

## Caching and privacy

- Bootstrap/public page data may use safe revalidation.
- Hint-bundle, one-hint, and resolution responses are `private, no-store`.
- Logs must not include signing secrets, answer IDs, credentials, or full reveals.
- No Redis, replay cache, per-action database write, or durable anonymous session is required.

## Deferred APIs

Compact completed-game submission/percentile reads, accounts, authoritative streaks/leaderboards, and head-to-head/social APIs require separate decisions.
