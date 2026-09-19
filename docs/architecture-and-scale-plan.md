# Architecture and launch-scale plan

Status: Living architecture source of truth  
Last updated: 2026-09-19

## Product goal

Build a polished daily baseball guessing product that supports at least 10,000 plays per day without a rewrite. Daily Nine and Classic Inning are currently distinct beta games over the same daily puzzle; beta feedback will determine the primary/sole broad-launch game. Infrastructure should preserve inexpensive game/ruleset seams without assuming both games survive launch.

Current Daily numbering is beta. A later explicit launch decision restarts the permanent sequence at Daily #1; beta history is not the permanent archive. Product details: `docs/product/beta-launch-results-archive.md`.

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Lineup content: `docs/product/lineup-content-system.md`.  
Current handoff: `docs/START-HERE.md`.

## Operating principles

- Repository-local versioned knowledge is the system of record.
- Stable facts/contracts remain durable; scoring, difficulty, game availability, and presentation may be tuned through explicit versions/decisions.
- Ownership and dependency direction are explicit and tested.
- Each PR has one bounded concern, focused tests, full CI, review, deployment verification, and documentation reconciliation.
- Do not add speculative infrastructure.

## Ownership

### `packages/shared`
Stable portable types, schemas, settings, ruleset identifiers, and serialization contracts.

### `packages/engine`
Pure outcomes, versioned scoring/completion, runner advancement, search behavior, result validation/derivation, and share/result calculations. Depends only on shared.

### `packages/baseball-data`
Canonical identity, aliases, teams, seasons, career facts, enrichment, provenance, QA, generated runtime artifacts, canonical-ID format validation, and deterministic reveal-shard access. Web code does not reinterpret facts.

### `packages/daily`
Puzzle identity/numbering, future gameplay profiles and lineup recipes, selection, recognizability/difficulty policy, repeat/diversity constraints, validation, editorial lifecycle, provider-neutral puzzle/result orchestration boundaries, public eligibility, and seven-day orchestration.

### `apps/web`
Next.js/React rendering, browser persistence, search/hint/resolve/admin/result routes, signed-token authorization, current-batter hint bundles, server-only canonical runtime composition, sharing, HTTP Basic editor boundary, and Supabase adapters.

### Supabase/Postgres
Operational persistence behind provider-neutral ports: current editorial puzzles and future profiles, recipes, and compact completed results. It does not own baseball facts, scoring, comparison semantics, recipe semantics, or lifecycle rules.

## Dependency direction

```text
shared
  ├── engine
  └── baseball-data
         \
          daily
            \
             web / API / admin adapters
                       \
                        persistence providers
```

Dependencies do not point upward. React and routes transport/render domain behavior rather than define it.

## Versioned gameplay

Native completed-at-bat facts preserve slot, initials, HR/3B/2B/1B/BB/K, hints revealed, wrong guesses, and correct/strikeout/Give Up resolution.

- `classic-inning-v1`: Classic beta game; same daily nine today, existing runner advancement, run scoring, three outs or nine at-bats.
- `points-v3`: Daily Nine beta game; seven points per at-bat minus verified hints/wrong guesses, zero at three wrong guesses or Give Up, all scheduled at-bats, maximum 63 for nine.
- `points-v2`: Daily Nine compatibility policy, `4/3/2/1/0.5/0`, all scheduled at-bats, maximum 36 for nine.
- `points-v1`: compatibility policy, `5/4/3/2/1/0`, all scheduled at-bats, maximum 45 for nine.
- `legacy-inning-v1`: runner advancement and three-out completion for compatible pre-ruleset sessions.

Ruleset version flows through shared state, engine, signed progression, local persistence, final result, and share output. Point totals and resolved-result copy are derived from the engine policy and verified reveal/strike facts rather than duplicated in React. The pure engine completion policy is reusable by signed progression so server and client agree. Do not build a generic plugin framework.

Daily Nine and Classic are independently modeled games. Playing one never completes the other, and completed-result/comparison populations never mix. Their current shared lineup is not an architectural identity requirement. Either game may later be disabled/removed without corrupting the other game's data; separate lineups remain possible without being current scope.

## Immediate active-at-bat hint architecture

The former per-click `/api/daily/hint` client path caused visible latency. The active design is:

```text
verified current progression
  -> server joins only current pitch hints
  -> browser receives four-hint active bundle
  -> local Hint click selects next value + signed checkpoint
  -> guess/Give Up resolution verifies checkpoint
  -> response supplies refreshed same-pitch or next-pitch bundle
```

### Bundle contract

A bundle contains:

- current pitch number;
- already revealed depth;
- all four current-batter hint labels/values;
- signed checkpoints only for later reveal depths still available.

It contains no answer ID/name, reveal record, credentials, or future-batter hints.

### Delivery paths

- Bootstrap includes batter one’s bundle.
- Incorrect resolution returns the same pitch’s bundle with updated strike claims.
- Correct/K/Give Up returns the next pitch’s bundle unless complete.
- `/api/daily/hints` hydrates only the bundle authorized by a compatible saved token.
- The legacy one-hint route remains server-compatible but is absent from active client chunks.

### Integrity consequences

The browser can inspect all current-batter hints and still holds the current signed token. That is accepted under the anonymous noncompetitive threat model. The architecture prevents accidental answer/future-pitch leakage, not adversarial score claims. Stronger incentives require server-authoritative attempts.

No browser encryption, all-nine hint preload, Redis, replay cache, durable anonymous session, or per-Hint database write is introduced.

## Canonical player and lineup-content architecture

```text
versioned factual sources
  -> canonical player facts/enrichment
  -> separate gameplay profiles
  -> versioned lineup recipe
  -> portable candidate generation/validation
  -> editor review/replacement
  -> exact scheduled/published nine
  -> observed solve data
  -> later calibration
```

Facts and editorial judgments remain separate. Standard Daily is one recipe, not the only selector. A finalized puzzle stores exact ordered canonical IDs; later profile/recipe changes do not alter it.

Automatic generation and authorized manual curation intentionally use different candidate boundaries. Automatic generation continues to consume only ranked `dailyEligiblePlayers`; editorial search/replacement may additionally expose canonical, reveal-ready players from the broader Daily-compatible player universe. Editorial-only candidates carry `recognizabilityRank: null`, so portable generation cannot select them, while manual validation surfaces `outside-automatic-daily-pool`. This is an editorial override capability, not a baseball-data promotion: it does not mutate facts, alter `dailyEligiblePlayers`, or change future generated lineups. Exact-nine uniqueness, repeat/reveal warnings, future-date rules, lifecycle audit, and published-puzzle immutability remain unchanged.

## Runtime and answer protection

- Public puzzle metadata/initials and the active batter’s hints may reach the browser.
- Answer IDs/names and canonical reveal data remain server-side until terminal resolution.
- Unrelated future-batter hints remain server-side.
- Signed claims control puzzle, ruleset, pitch, reveal depth, strikes, outs, and completion.
- Search is spoiler-safe and initializes its full candidate set only on the search path.
- Ordinary canonical-format guesses compare directly with the server-only canonical answer ID and do not require full-universe identity initialization.
- Legacy/noncanonical submitted IDs cross the canonical redirect boundary only when used.
- Terminal reveal reads the deterministic answer shard directly; full canonical search/index state is not required solely to locate a reveal.
- Service-role credentials remain server-only.
- Replay is an accepted anonymous limitation.

### Public Daily resolution performance

The public web runtime caches the fully materialized server-only `DailyPuzzle` by puzzle date in Next's Data Cache. Materialization includes the authoritative editorial/fallback selection, exact canonical IDs, hints, and puzzle metadata needed by signed resolution. The cache has a 300-second safety revalidation window and is invalidated after every successful write through the authenticated web admin repository.

This final-puzzle cache replaces the narrower row-only cache. On a cache hit, `/api/daily/resolve` does not need to query Supabase, rebuild the nine-player puzzle, rank the Daily candidate universe, or initialize the public lineup source. The heavyweight Daily lineup/public-source and Supabase modules are loaded only when a materialized-puzzle cache miss requires reconstruction.

Search-candidate construction is separated from the resolve composition. The full canonical player index remains available for search and legacy-ID resolution, but it is not loaded merely to process a normal canonical-format guess. Terminal reveal uses deterministic shard addressing from the canonical player ID so a correct guess, third strike, or Give Up can load only the needed reveal shard.

`POST /api/daily/resolve` retains its `daily-resolve` `Server-Timing` duration. Because that metric begins inside the route handler, comparing it with real-browser end-to-end latency helps identify any remaining browser/network/platform-startup component after the hot path is reduced; it contains no answer data.

These are web/server runtime optimizations only. They do not change scoring, lifecycle rules, progression claims, publication authority, or public payloads. Supabase remains authoritative for editorial records. A syntactically valid but nonexistent canonical submitted ID is treated as an incorrect anonymous guess rather than forcing a full player-index validation; legacy/noncanonical IDs remain explicitly validated. Out-of-band database edits that bypass the authenticated admin path may remain cached until the safety revalidation window expires.

## Private recap presentation

The web adapter retains terminal canonical display names in a browser-local `scorecardAnswers` map keyed by pitch number, separate from portable game facts and `DailyShareResult`. Only resolved slots survive restoration. Scorecard and share-card components receive separate inputs; clipboard copies only the existing engine-formatted spoiler-safe text. No server payload, data dependency, or answer-authority change is required.

## Completed-result and comparison architecture

September 19 review of main `a91edc0`: preserve the boundaries below. R1 outbox ownership lifetime is repaired by binding delivery/retry and acknowledgment writes to one disposable exact attempt/generation owner session, invalidated before lock release. R2 gameplay request lifetime is repaired with a synchronous single-flight controller invalidated by Reset/restore plus persistence-session teardown/owner loss. R3 persistence authorization separates exclusive Web Lock authority from resolved-AB eligibility. R4 persistence re-bootstrap is also repaired: semantic puzzle/ruleset session identity avoids object-identity ownership churn, readiness resets on real session changes, and save/reset require the rendered and live authority/readiness capabilities to match exactly. Evidence, tradeoffs and bounded PR sequence: `docs/engineering/resolved-at-bat-review-2026-09-19.md`.

The current completed-result path performs **one compact idempotent write after completion**. The approved resolved-AB extension below adds terminal observations, not per-hint/per-guess writes. Portable validation/derivation, the provider-neutral idempotent repository/service boundary, the server-only Supabase provider, the completed-game POST boundary, and the browser retry adapter are implemented. Native activation adds only browser-local provenance plus React/game composition; it does not move gameplay rules or idempotency semantics out of their existing owners.

A submission identifies the stable puzzle, ruleset/game, and a client-generated idempotency ID, and carries ordered native completed-at-bat facts. The server validates exact puzzle identity and fact consistency and derives summaries through portable rules; it never trusts a client-submitted total score.

`shared` exports schema-1 submission/result types. Engine `validateDailyCompletedResult` accepts only `points-v3` and `classic-inning-v1`, checks the caller-provided puzzle/game and raw facts, and reuses `getGuessOutcome` plus `applyDailyOutcomeForRuleset` for derivation/completion. Output keeps copied, whitelisted facts and a game-specific summary; it drops client totals/answer fields. It does not prove honest play or native provenance. See `docs/spec/engine.md` and `docs/spec/data-model.md`.

`packages/daily` now owns the provider-neutral persistence orchestration. `DailyCompletedResultRepository.insertIfAbsent(result)` is an atomic first-write-wins port keyed by `submissionId`: a provider inserts the complete normalized result if absent, otherwise returns the existing stored result without overwriting it. `createDailyCompletedResultService` compares explicit normalized contract fields. Same ID plus the same normalized result is an idempotent retry; the same ID plus any different puzzle, ruleset/game, raw at-bat fact, or derived summary is an `idempotency_conflict`. This is intentionally not implemented as a race-prone `get` then `save` sequence. Scope: `tasks/plans/completed-result-repository.md`.

The service consumes only the engine-derived `DailyCompletedResult`; it does not duplicate validation, scoring, or completion logic. It retains the complete normalized raw facts so later aggregates can be recomputed as presentation evolves.

The Supabase provider now maps that normalized result to `public.daily_completed_results` through a server-only row codec and an insert-first adapter. `submission_id` is the database primary key. A successful insert returns the inserted normalized row; a PostgreSQL unique-key conflict triggers a read of the existing winner, which 4B then compares field-by-field. There is no upsert/update path. RLS is enabled with no browser policies, and `service_role` is restricted to direct `SELECT` and `INSERT` table privileges. Provider receipt time is stored as `created_at` but does not enter the portable result contract.

The web submission boundary is `POST /api/daily/results`. It preflights only routing fields needed before puzzle lookup, rejects future Pacific dates, loads the same authoritative cached public puzzle used by gameplay without minting progression tokens/hint bundles, calls engine validation/derivation, then stores through 4B/provider. Responses contain only created/existing/error status and are `private, no-store`. The browser adapter persists a separate immutable submission record before network I/O: exact schema-1 payload, one stable client-generated ID, and local pending/terminal status. Every retry reuses that exact payload, so the same ID cannot drift across replay facts. Same-tab requests are single-flight, and an async response mutates local status only when its ID still owns the stored record. `allowCreate=false` supports retrying an existing pending record without retroactively minting one. Save hydration reports whether explicit completed-at-bat facts were native or compatibility-reconstructed without changing the persisted gameplay schema. New delivery-record creation is allowed only from an eligible current session that later completes; existing pending delivery records may retry after hydration independently of gameplay completion state. Local gameplay reset does not clear the separate result-delivery record. On September 18 the complete browser→API→engine→repository→Supabase path was proven in production: one fresh Daily #144 / `points-v3` completion inserted one row, and replaying the exact same schema-1 payload/submission ID returned the existing result with row count unchanged.

Implemented target architecture with normal-path browser proof and R1–R4 lifecycle repairs (comparison reads are not yet activated): Daily Nine receives one immutable observation per terminal AB, independently of completed-game collection. Shared owns transport; engine validates/scores; Daily owns idempotency/read ports; web owns browser coordination, routes and Supabase adapters. Store engine-derived AB points once and aggregate in the database. Keep resolved-AB and completed-game populations/counts separate. Do not merge PR #174's equal-population invariant.

The resolved-AB provider maps the normalized result to one flat `public.daily_at_bat_results` row through a server-only codec and insert-first adapter. Its composite primary key is `(attempt_id, puzzle_id, ruleset_version, pitch_number)`; a separate `(puzzle_id, ruleset_version, pitch_number) INCLUDE (awarded_points)` index serves the later population read. A unique conflict reads the existing winner by the complete key for the Daily service to classify. There is no update/upsert path. RLS is enabled with no browser policies, and `service_role` has direct `SELECT` and `INSERT` only. Hosted migration and isolated simultaneous same-key insertion were verified before the API layer. Scope: `tasks/plans/resolved-at-bat-supabase-provider.md`.

`POST /api/daily/at-bats` is the separate resolved-AB submission boundary. It preflights schema/date/points-v3 routing, rejects future Pacific dates, loads the authoritative cached public puzzle without minting progression tokens/hints, calls engine validation/point derivation, then stores through Daily/provider. Created, existing, conflict, invalid and unavailable outcomes are deliberately mapped to private/no-store responses containing no facts or points. It is not called by `/api/daily/resolve`; browser 6D calls it asynchronously only after owner gameplay persistence and immutable journal freeze. Scope: `tasks/plans/resolved-at-bat-submission-api.md`.

Gameplay resolution must not await comparison persistence or reads. A combined submission/read response distinguishes saved result from unavailable comparison; read-only recovery does not resubmit acknowledged records. Briefly cached comparisons are acceptable without immediate self-inclusion. Preserve the current completed-result foundation and legacy pending payloads. Current progression tokens have no attempt identity/history and do not establish honest play.

The approved browser gate uses a long-lived exclusive Web Lock per stable puzzle/ruleset plus a separate versioned `localStorage` attempt journal/outbox. Browser 6A implements durable immutable attempt/outbox state; 6B implements exclusive queued ownership and generation fencing; 6C composes ownership with points-v3 gameplay persistence; 6D implements the activation edge. A genuinely fresh owned run still requires the gameplay key to be truly absent. Every owner autosave persists gameplay first; only a successful save may freeze the persisted native terminal fact set (`pendingAdvance.completedAtBats` when present, otherwise game-state facts). Newly frozen slots schedule asynchronous `POST /api/daily/at-bats`; existing pending slots retry after ownership/hydration. Network/transient failure leaves exact payloads pending, while conflict/rejection/stale/unavailable delivery fails the current local contribution closed. The network path never blocks gameplay. A fresh active attempt ID is reused only when creating a new points-v3 completed-result record; an existing completed-result record wins unchanged. Pre-rollout saves remain completion-only, mismatches retire without backfill, supported followers remain passive/non-writing, and Classic/older/unsupported compatibility sends no resolved ABs. No timeout lease, forced steal, background worker, or server session is introduced. The conservative crash behavior remains intentional: save-before-freeze failure produces undercount/retirement on takeover, and retire-before-clear failure remains retired. Production collection is browser-proven: exact-deployment/database first-write evidence, current-browser owner/follower/takeover, fresh attempt/completion identity equality, physical Safari restore, cleanup, and route runtime health are recorded in the 6D plan/runbook. Scope: `tasks/plans/resolved-at-bat-browser-outbox.md`, `tasks/plans/resolved-at-bat-browser-ownership.md`, `tasks/plans/resolved-at-bat-browser-gameplay-lifecycle.md`, `tasks/plans/resolved-at-bat-browser-6d.md`, and `tasks/plans/resolved-at-bat-browser-lifecycle.md`.

Use the new immutable AB table and indexed population reads, not mutable rollups. Exact AVG still scans the population; benchmark mixed read/write load and concurrency before claiming capacity. Later caching/rollups sit behind read ports. The portable comparison contract in `packages/daily` keeps resolved-AB and completed-game reads independent: one slot returns received count plus stored engine-derived point sum, while completed games return score buckets that normalize to a bounded 0–63 histogram. Daily derives null-or-average values and strict-lower finishers semantics without rescoring. Freshness/caching metadata belongs to the later web/API read contract rather than this portable Daily service. Provider errors remain separate from write/idempotency status. Detailed owning-layer PR sequence and gates: `tasks/plans/resolved-at-bat-comparison.md`. Classic's overall ranking remains unresolved.

This architecture supports either beta game surviving launch without doubling persistence infrastructure or mixing incompatible populations.

## Permanent launch and archive architecture

Current beta Daily numbering is not permanent history. When the owner explicitly chooses the broad-launch game/rules and launch date, that date becomes permanent Daily #1. No current beta puzzle must be migrated into the public archive.

From permanent Daily #1 onward, issued puzzles are frozen historical objects. Later generator/profile changes cannot silently alter them. The archive exposes prior permanent Dailies through stable identity, and archive browser state/history is isolated from the current Daily.

The initial personal-history layer is browser/device-local and keyed by stable Daily identity plus game/ruleset. It remembers which archived games were completed and the recorded result without creating an account identity. Cross-device history remains deferred until accounts.

## Editorial persistence

`daily_editorial_puzzles` remains authoritative for editorial dates: one row/date, atomic exact-nine JSONB selection, lifecycle status, optimistic revision, audit metadata, RLS, and server-only service role. `daily_completed_results` is the separate current completed-result provider table behind the portable result repository; it stores immutable normalized submissions plus provider receipt time and is not a gameplay-rule authority. Future profiles/recipes require separate portable contracts and migrations. Inactive legacy attempt/result tables are not repurposed for the current result system.

## Scale target

At 10,000+ plays/day:

- serve immutable baseball artifacts cacheably;
- cache the fully materialized authoritative public puzzle instead of rebuilding it on every resolution;
- keep heavyweight lineup/search initialization off unrelated request paths;
- use deterministic reveal shards so terminal resolution reads only the answer shard;
- keep visible anonymous state client-side;
- verify stateless progression;
- perform no database write per hint/guess;
- hydrate at most one active hint bundle on saved refresh;
- submit at most one compact completed result;
- keep routes thin and credentials isolated.

Vercel and Supabase remain replaceable adapters. No new cache service, queue, database, or hosting-specific compute mode is required for the current optimization.

## Continuity controls

- `AGENTS.md` is a map; structured docs own deeper truth.
- PRs include Documentation impact.
- CI requires canonical-doc updates or a specific exception for material diffs.
- Hosted work is incomplete until START-HERE/todo are reconciled.
- Repeated review findings become tests/scripts/rules.

## Current sequence

1. Completed-result collection is live and production-proven for a native Daily Nine completion, including exact same-ID idempotent replay; preserve that 4A/4B/4C boundary unchanged unless a separate defect requires it.
2. Browser 6A–6D is implemented and normal-path browser-proven; review repairs R1–R4 are implemented. Preserve the exact current-session authority boundary before extending browser persistence.
3. The portable independent-population comparison contract/service and its server-only Supabase aggregate provider are implemented. PR #199 adds the shared, versioned comparison HTTP shape. The current route PR adds two thin web/server GET routes over the existing Daily comparison service: one exact at-bat slot read and one completed-game read. Callers cannot select puzzle ID/number; the server derives exact population identity from the authoritative public puzzle. The routes fail closed before provider work unless `DAILY_NINE_COMPARISON_READS_ENABLED=true`, so merging them does not expose unbenchmarked aggregate reads. When explicitly activated later, responses remain `no-store` and live-only until measured performance/cache work justifies a different policy. Engine-derived stored points remain scoring authority; React only renders.
4. Apply settled strict-lower-score tie semantics and initial presentation thresholds; keep them separate from persistence.
5. Continue outstanding interactive/physical-device QA plus timed editorial rollover/fallback observations without blocking the result pipeline.
6. Build Permanent archive/local-history infrastructure from the future explicit launch Daily #1, then finish broad-launch game/rules/epoch and launch polish.

## Non-goals

Rewriting the app; moving facts into Supabase/React; generic rules plugins; tamper-proof anonymous competition; microservices/queues/replay caches; accounts before the Daily loop is excellent; importing beta history into the permanent archive; building elaborate game-specific analytics before beta determines which game survives.

## Decision rule

Architecture is sufficient when scoring, completion, completed results, comparison, archive identity, player profiles, and lineup recipes can evolve without duplicating rules, corrupting facts/history, or rewriting unrelated UI/persistence. Code, tests, handoff, todo, and canonical docs change together.
