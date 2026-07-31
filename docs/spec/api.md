# Daily web API specification

Status: Living source of truth  
Last updated: 2026-07-31

Daily Inning is the only committed product. Current routes are thin Next.js transport adapters over canonical baseball data, engine rules, and portable Daily logic. Historical head-to-head, matchmaking, chat, league, and practice endpoint plans are deferred and are not current API contracts.

The launch answer-integrity rationale is recorded in `docs/decisions/0001-daily-answer-integrity.md`.

## General rules

Every Daily route must:

1. Validate request shape and range constraints.
2. Return sanitized public data only.
3. Never expose a hidden answer before a correct guess, third strike, or Give Up.
4. Resolve players by canonical or validated legacy ID, never display text.
5. Keep baseball outcomes and ruleset interpretation in `packages/engine` and portable Daily behavior in `packages/daily`.
6. Avoid per-action database writes or durable anonymous sessions at launch.
7. Return 4xx responses for invalid caller input and avoid reflecting secrets or hidden data in error messages.

## Public puzzle bootstrap

The Daily page receives:

- puzzle ID, number, date, and publication status;
- public hint configuration;
- the scheduled pitch numbers and initials;
- one opaque signed progression token for pitch 1, zero hints, zero strikes, zero outs, and the active ruleset version.

New Standard Daily bootstraps use `points-v1`. The token contains only public progression claims and no player answer or hint value. Initial HTML and client bundles must not contain answer IDs, answer names, full hints, or reveal records.

## Canonical player search

### `GET /api/players/search`

Searches the canonical player index and returns sanitized candidate context. Search may use display names and aliases, but the response carries canonical identity and enough context to distinguish genuine same-name players.

Search does not reveal which candidate is the hidden answer.

## Daily hint route

### `POST /api/daily/hint`

Request:

```json
{
  "progressionToken": "opaque-signed-token"
}
```

The server verifies the token and derives ruleset version, puzzle date, current pitch, hint depth, strikes, and recorded outs from its claims. The caller does not supply those values independently.

Response:

```json
{
  "hint": {
    "hintType": "teams",
    "hintLabel": "Teams",
    "hintValue": "..."
  },
  "progressionToken": "next-opaque-signed-token"
}
```

The next token increments hint depth for the same pitch. The route rejects invalid signatures, malformed or unsupported claims, completed tokens, cross-date/cross-puzzle use, and requests beyond the configured hint count.

This route remains the current transport. The approved next implementation replaces visible per-click latency with an authorized active-at-bat hint bundle while preserving the same scoring depth and answer-integrity boundary.

## Daily resolution route

### `POST /api/daily/resolve`

Guess request:

```json
{
  "progressionToken": "opaque-signed-token",
  "submittedPlayerId": "canonical-or-legacy-player-id"
}
```

Give Up request:

```json
{
  "progressionToken": "opaque-signed-token",
  "giveUp": true
}
```

The server verifies the token, derives the authorized current pitch and progression, resolves the submitted player through canonical redirects, and uses engine rules for the outcome.

Response:

```json
{
  "result": {},
  "reveal": null,
  "progressionToken": "next-opaque-signed-token"
}
```

Behavior common to all rulesets:

- an incorrect guess returns no reveal and a token with one additional strike;
- a correct guess returns the current player's reveal and a successor token;
- a third strike or Give Up returns the current player's reveal, records one additional out up to the public claim maximum, and returns a successor token;
- browser-supplied pitch number, reveal count, strike count, out count, or ruleset version is ignored because those fields are not part of the request contract.

`points-v1` behavior:

- a third recorded out does not complete the game;
- the successor token advances through every scheduled pitch;
- only resolution of the final scheduled pitch returns a completed token.

`legacy-inning-v1` behavior:

- three recorded outs or the final scheduled pitch returns a completed token;
- the policy exists for compatible pre-ruleset signed sessions rather than new Standard Daily bootstraps.

A completed token cannot authorize another hint or resolution.

## Progression-token contract

Claims are versioned and contain only:

- contract version;
- ruleset version;
- puzzle ID;
- puzzle date;
- current pitch number;
- reveal count;
- strike count;
- recorded out count;
- completion state.

Signing uses a server-only secret and HMAC. Production and preview use `DAILY_PROGRESSION_SECRET`; it must never use a `NEXT_PUBLIC_*` name or cross into client props or logs.

Verification rejects:

- malformed encoding or JSON;
- unsupported contract or ruleset version;
- invalid signature;
- invalid puzzle ID/date relationship;
- pitch, hint, strike, or out values outside legal ranges;
- a completed token used for an answer action.

Valid pre-ruleset tokens whose signed payload omitted `rulesetVersion` normalize to `legacy-inning-v1`. They retain the prior three-out completion rule instead of being silently reinterpreted as `points-v1`.

Tokens are stateless and replayable. The API does not promise one-time action consumption or tamper-proof anonymous scoring.

## Browser persistence and migration

The browser stores the opaque progression token with public local gameplay state. On refresh, the token remains the server authorization source while local state owns visible points, baseball display state, and spoiler-safe raw completed-at-bat facts.

Current local state carries:

- ruleset version;
- point total, maximum, and at-bat progress;
- ordered initials/outcomes;
- slot, hint depth, wrong guesses, and correct/strikeout/Give Up resolution for native completed at-bats.

A saved state without a compatible token must not invent authorized progression. Compatible pre-ruleset schema-3 sessions normalize to `legacy-inning-v1`; untouched older starts may restart under the current bootstrap; completed historical results remain readable when possible.

## Caching and privacy

- Immutable canonical player data and public puzzle metadata may use CDN-friendly caching.
- Responses containing a newly signed progression token must not be cached in a way that exposes server secrets; the token itself contains no hidden answer data.
- Request or application logs must not include signing secrets, answer IDs, hint values, or full reveal payloads.
- No database, Redis, replay cache, or hosting-specific state is required for these routes.

## Deferred API families

The following require separate product and architecture decisions before implementation:

- compact completed-game submission and percentile reads;
- accounts and authenticated streaks;
- authoritative competitive attempts or leaderboards;
- head-to-head game proposals and gameplay;
- matchmaking;
- chat and safety actions;
- leagues;
- paid features.

A future competitive model must not silently reuse the anonymous stateless-token guarantees as if they were server-authoritative attempt history.
