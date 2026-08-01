# ADR 0001: Daily launch answer integrity

Status: Accepted, amended 2026-08-01  
Original date: 2026-07-20

## Decision

Daily Inning launches as an anonymous, client-driven, noncompetitive game. The security goal is to prevent accidental/easy answer leakage and arbitrary future-at-bat requests. The launch does not claim tamper-proof scoring, one-attempt enforcement, or adversarial anti-cheat protection.

Web routes authorize progression with stateless HMAC-signed tokens. Claims contain only public progression fields:

- contract and ruleset version;
- puzzle ID and Daily date;
- current pitch number;
- revealed-hint count;
- strike and recorded-out counts;
- completion state.

Tokens contain no answer ID, player name, hint value, reveal record, score, base state, credential, or private baseball data.

## Active-at-bat hint amendment

All four hint values for the **currently authorized batter** may be delivered to the browser before that at-bat appears. The bundle also contains signed checkpoints for later reveal depths. Pressing Hint becomes a local state transition: the browser reveals the next value and adopts the corresponding signed token.

This amendment changes the former rule that initial props contained no hint values. The current answer boundary is:

- current-batter hints may be plaintext in browser memory and initial/authorized payloads;
- answer IDs, answer names, canonical reveal records, and unrelated future-batter hints remain server-side;
- bootstrap includes only batter one’s bundle;
- an incorrect guess returns a refreshed bundle for the same batter and strike count;
- a terminal resolution may return the next batter’s bundle;
- saved progression may hydrate only the bundle authorized by its verified token;
- no public request can select an arbitrary future pitch.

The accepted consequence is that a technically motivated user can inspect all current-batter hints before clicking them and may replay an earlier valid token. That is consistent with the anonymous, noncompetitive launch threat model. Prizes, authoritative streaks, or public competitive rankings require a stronger server-authoritative design.

## Progression behavior

The server derives puzzle, ruleset, pitch, hint depth, strikes, outs, and completion from verified claims rather than browser counters.

- A signed hint checkpoint increases reveal depth for the same pitch.
- An incorrect guess increases strikes for the same pitch and returns no reveal.
- A correct guess returns only the authorized current reveal and advances to the next scheduled pitch.
- Third strike or Give Up returns only the authorized current reveal and records an out.
- `points-v2` is the current bootstrap policy and continues through all scheduled at-bats even after three recorded outs.
- Compatible `points-v1` sessions also continue through all scheduled at-bats even after three recorded outs.
- `legacy-inning-v1` completes at three outs or puzzle exhaustion for compatible pre-ruleset sessions.
- A completed token authorizes no later hint bundle or answer action.

The browser may persist the opaque token with public local gameplay state. Tokens are shareable and replayable. Replay cannot forge a later pitch, change date/puzzle, or create a valid signature.

## Required protections

- Initial/public payloads and client bundles contain no answer IDs, answer names, canonical reveal records, credentials, or unrelated future-batter data.
- Only active-batter hints may cross before terminal resolution.
- The active client does not make a network request when Hint is clicked.
- Signed checkpoints never reduce the current strike count or offer reveal depths below the authorized current depth.
- A token for one puzzle/date cannot authorize another.
- Correct, third-strike, and Give Up responses reveal only the token-authorized current player.
- Saved-state restoration verifies the token before hydrating hints.
- Signing uses a server-only secret in `apps/web`.

## Accepted limitations

- A determined user may inspect current-batter hints in developer tools.
- A determined user may replay an earlier valid request/token.
- A user may reset or manipulate local browser state or deliberately Give Up through the lineup.
- Anonymous score claims are not tamper-proof or server-authoritative.
- Public leaderboards, prizes, competitive rankings, and account-bound streak integrity are outside this model.

## Explicitly rejected for launch

- client-side encryption merely to obscure current hints;
- preloading unrelated future-batter hints;
- replay caches, Redis, or Vercel Runtime Cache;
- per-action database writes;
- durable anonymous server sessions;
- moving scoring or Daily transitions into Next.js routes.

## Ownership consequences

- `packages/engine` owns scoring and outcomes.
- `packages/daily` owns portable puzzle creation and editorial transitions.
- `apps/web` owns signing, verification, authorized hint bundles, HTTP transport, and browser persistence.
- No domain package imports React, Next.js, browser storage, host APIs, or secrets.
- Vercel remains replaceable.

## Secret and versioning policy

Production and preview use server-only `DAILY_PROGRESSION_SECRET`. It must not cross `NEXT_PUBLIC_*`, props, logs, or client bundles. Token and ruleset formats are versioned so compatible `points-v2`, `points-v1`, and legacy sessions can coexist during migration.

Verification rejects malformed encoding/JSON, unsupported versions, invalid signatures or ranges, cross-date/puzzle use, and completed tokens used for later actions.

## Future replacement trigger

Accounts, prizes, public competitive leaderboards, authoritative streaks, or other meaningful cheating incentives require a separate decision covering atomic server-authoritative attempts, persistence, idempotency/replay, cost, privacy, and migration.

## Validation requirements

Implementation must test:

- bootstrap exposes exactly one active-batter bundle;
- no future-batter hint or answer/reveal data leaks;
- checkpoint signatures and claim depth/strike preservation;
- local Hint transitions without the legacy per-click route in client code;
- refreshed same-pitch and next-pitch bundles;
- invalid, cross-date, future-pitch, and completed-token rejection;
- saved-token bundle hydration;
- third strike, Give Up, all-nine and legacy completion;
- production payload/bundle QA, full tests, typecheck, data pipeline, and build.
