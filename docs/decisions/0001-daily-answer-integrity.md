# ADR 0001: Daily launch answer integrity

Status: Accepted
Date: 2026-07-20

## Decision

Daily Inning launches as an anonymous, client-driven, noncompetitive game. The launch security goal is to prevent accidental or easy answer leakage and to stop a caller from directly requesting an arbitrary future at-bat. The launch does not claim tamper-proof scoring, one-attempt enforcement, or adversarial anti-cheat protection.

Web routes will authorize progression with a stateless HMAC-signed token. The token contains only public progression fields:

- contract version;
- puzzle ID and Daily date;
- current pitch number;
- revealed-hint count;
- strike count;
- inning out count;
- completed state when no later pitch is authorized.

The token contains no answer ID, player name, hint value, reveal record, score, base state, or other hidden baseball data.

The server signs the initial token and every valid successor token. Hint and resolution routes verify the signature and derive the puzzle date, current pitch, hint depth, strikes, and outs from the verified claims rather than accepting those counters from the browser.

State transitions are deterministic:

- revealing a hint increments hint depth for the same pitch;
- an incorrect guess increments strikes for the same pitch;
- a correct guess authorizes the next pitch with the same out count;
- a third strike or Give Up increments outs and authorizes the next pitch only when the inning remains active;
- three outs or exhaustion of the nine scheduled pitches produces a completed token that authorizes no later answer action.

The browser may persist the opaque token alongside its local public gameplay state. A token is shareable and replayable. Replaying an earlier valid token can repeat an earlier action, but it cannot forge later progression, change its Daily date, or directly select an arbitrary future pitch.

## Required launch protections

- Initial HTML, serialized props, client bundles, logs, share text, and public static data contain no answer IDs, answer names, hint values, or reveal records.
- The server does not trust browser-supplied pitch number, hint depth, strike count, or out count.
- A token for one puzzle or date cannot authorize another puzzle or date.
- Correct, third-strike, and Give Up responses reveal only the token-authorized current player.
- Ordinary refresh recovery remains reliable.
- Signing uses a server-only secret and a provider-neutral Web/Node cryptographic boundary inside `apps/web`.

## Accepted launch limitations

- A determined user may replay an earlier valid request.
- A user may reset or manipulate their own local browser state.
- A user may deliberately Give Up through the lineup.
- The game does not claim one-time action consumption, tamper-proof local scoring, or authoritative anonymous attempt history.
- Public leaderboards, prizes, competitive rankings, and account-bound streak integrity are outside this model.

## Explicitly rejected for launch

- replay caches;
- Vercel Runtime Cache;
- Redis;
- a database table for anonymous action state;
- per-action persistence writes;
- durable anonymous server sessions;
- forced dynamic rendering solely to create unique sessions;
- moving scoring or Daily transition rules into Next.js routes.

## Ownership and dependency consequences

- `packages/engine` continues to own scoring and baseball outcomes.
- `packages/daily` continues to own portable Daily puzzle creation and transitions.
- `apps/web` owns token signing, verification, HTTP transport, and browser persistence because the token is a web authorization adapter.
- No domain package imports React, Next.js, browser storage, hosting APIs, or cryptographic secret configuration.
- Vercel remains a replaceable host.

## Secret and deployment policy

Production and preview deployments use a server-only `DAILY_PROGRESSION_SECRET`. The secret must not be exposed through `NEXT_PUBLIC_*`, initial props, logs, or client bundles. Tests use injected fixed keys. Local development may use an explicit development-only fallback, but production startup or request handling must fail closed when the required secret is absent.

Token format and signing details are versioned so a later contract can coexist during saved-state migration. Verification rejects malformed tokens, unsupported versions, invalid signatures, invalid claim ranges, cross-date use, and completed tokens used for answer actions.

## Alternatives considered

### Trust browser counters

Rejected. It allows direct future-pitch requests and fabricated hint/strike progression.

### Stateful one-time tokens with replay storage

Rejected for launch. It adds provider-specific or database-backed per-action state, operational cost, retry semantics, and migration complexity without competitive stakes that justify those guarantees.

### Put all gameplay state on the server

Rejected for launch. Anonymous Daily gameplay is intentionally client-driven, and server-authoritative attempts would duplicate current state ownership and require durable sessions.

### Expose all answer data and rely on normal users not inspecting it

Rejected. Preventing easy and accidental leakage is a launch requirement.

## Future replacement trigger

Accounts, prizes, public competitive leaderboards, authoritative streaks, or other meaningful cheating incentives require a separate decision. A stronger model would need atomic server-authoritative attempts, persistence design, idempotency and replay semantics, cost/scale review, privacy review, and migration from anonymous local state.

## Validation requirements

The implementation PR must test:

- valid initial claims and deterministic successor transitions;
- signature tampering and malformed tokens;
- cross-date and cross-puzzle use;
- arbitrary future-pitch attempts;
- hint progression and maximum hint depth;
- incorrect guesses, third strikes, and Give Up;
- three-out and ninth-pitch completion;
- terminal reveal boundaries;
- saved-token refresh recovery and migration behavior;
- hidden-answer production bundle QA;
- full typecheck, tests, file-size checks, canonical data pipeline, runtime-consumer QA, and production build.
