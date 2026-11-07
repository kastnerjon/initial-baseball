# Secondary official Daily scoring admission (#566)

Proposed design for architecture review. Keep secondary contributions disabled until the implementation, hosted QA and release gates in the multi-Daily plan pass.

## Existing boundaries

The Daily progression token authenticates puzzle identity and game counters. It carries neither a competitive attempt identity nor a durable transition revision. Existing submissions take routing fields from the caller. The at-bat repository deduplicates by attempt, puzzle, ruleset and pitch; the completion repository resolves collisions by submission ID. Revalidating a scorecard against the same nine players cannot establish which edition produced it.

## Start and resume

1. Resolve the frozen publication by immutable ID and the server's Pacific game date. Verify the issued ruleset. Never issue live eligibility from an archive or practice start.
2. Bind the reservation to an established, high-entropy anonymous browser credential via a server-side digest. A stable server-issued browser-identity ID (resolved through a versioned credential-digest lookup) uniquely identifies a retained browser; a unique constraint over that stable ID, puzzle ID and ruleset lets concurrent starts return the same durable attempt. Generate its ID on the server. Separate the practice path so it cannot consume someone's first live reservation.
3. An existing live reservation retains its original eligibility after midnight, including pending retries. Credential loss starts a separate anonymous identity. Do not assign multiple competitive reservations during simultaneous first opens while the browser has no shared credential. Competitive starts for that condition stay disabled until real two-tab QA demonstrates convergence.
4. Sign a versioned, domain-separated progression envelope carrying the attempt ID, exact puzzle ID, date, issued ruleset and revision. Verify the signature before selecting a population. Match every bound field against the stored attempt and credential. Keep scoring keys server-only; document key retention and maximum retry lifetime before activation.

## One authoritative transition

Use the existing shared engine and frozen publication to derive each transition. Adapt the reservation and compare-and-swap pattern from Custom v2 while keeping Daily eligibility independent of Custom ownership. Commit against the expected predecessor revision. Persist the accepted command identity, successor state and response needed for a lost-response replay. Identical retries return that committed result; a different command against the same predecessor returns a conflict and resumes from the winning state.

For a terminal at-bat, write the server-derived observation in the same transaction. For game completion, project from the accepted ledger and commit once using a stable server-generated submission ID. Use unique constraints on attempt/pitch and attempt/completion. Bind the population to the stored date, ID and ruleset. No caller-supplied scorecard, title, display number or roster hash selects the population. A failed transaction contributes nothing. Apply the same eligibility check to per-batter and completed-game writes.

## Verification before integrating public gameplay

- Two same-date editions with identical rosters and hints: swap ID, credential, signed token, attempt, ruleset and scorecard independently. Assert zero unintended rows in either population.
- Race identical and different commands from two tabs, retry after commit with the response lost, roll back an interrupted transition, refresh mid-at-bat, then finish. Inspect reservation, pitch, completion and comparison row counts.
- Exercise last-minute live start and delayed retry after Pacific midnight, first archive practice, two empty tabs, cookie loss, malformed credentials, and a browser previously used for Custom. Confirm legacy primary and historical result behavior.
- Demonstrate that browser roles cannot write the ledger or its projections directly. Accept only server-authorized transitions. Rehearse additive migrations in isolated QA and exercise rollback with issued games and queued retries.
- A separate architecture review must settle initial browser credential convergence, recovery/expiry and atomic persistence before modifying submission authority. Production schema, public activation and physical-device acceptance remain separate release gates.

## Proposed A3 resolution: anonymous credential convergence and atomic admission

This is a **proposal for independent architecture/security review**, not approval to enable secondary edition score writes. The existing Daily Nine, Classic and Archive paths retain their current rules and historical identities.

### Two empty tabs and one retained browser credential

The server mints a high-entropy, host-only, HttpOnly, Secure, SameSite=Lax anonymous Daily browser credential. The private repository stores a domain-separated HMAC digest of this capability, never its raw value. It represents a retained browser profile, not a person, verified account, device fingerprint, or cross-device identity.

Before its first competitive edition bootstrap, a supported browser obtains an **origin-wide exclusive Web Lock**, then performs an initialization request followed by a separate server-confirmed cookie round trip. The lock is held across the complete Set-Cookie/readback handshake. A second tab must wait and reuse the established cookie rather than minting a competing credential. Existing per-puzzle Web Locks do not suffice for two first opens of *different* editions; the credential initialization lock must be global across new Daily editions. Ordinary page rendering, prefetch and read-only Archive discovery never initialize credentials.

If exclusive locking, cookie persistence/readback or required browser storage/abort capabilities are unavailable, the browser may still play practice mode but must **not** start a competitive anonymous attempt. Verify this with actual two-tab Safari/Android/browser races, delayed first responses, abort and refresh. A malicious client can bypass browser locks, and users can clear cookies; one-attempt-per-human is unattainable without stronger identity. This design protects against accidental cooperating-browser races, not all anonymous abuse.

### Interrupted first-open fencing: no ambiguous Set-Cookie overwrite

An exclusive Web Lock is necessary but **not** a sufficient recovery guarantee: a cancelled tab or stalled response can still write a late `Set-Cookie` after another tab acquires the lock. Before issuing any request, the lock holder persists one random, high-entropy origin-wide **initialization generation** in shared browser storage. That generation is only an idempotency/selection identifier, **never** an authentication capability and never sufficient for score admission. The server issues the actual high-entropy HttpOnly credential at most once for this generation, using an atomic single-writer initialization record; only its domain-separated digest and internal identity are durable. Duplicate or interrupted initialization requests cannot mint a second credential for the same generation, and must not set a different cookie value. They return a safe pending/unverified status instead. No raw credential or decryptable copy is retained for replay.

The cookie name is generation-qualified (for example `__Host-ibd-v1-<128-bit generation hash>`, with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` and no Domain). Requests select only the cookie for the **currently persisted** initialization generation, and the server additionally requires its valid digest/identity mapping; a generation identifier by itself cannot authorize anything. A delayed response for a superseded generation can only write its **old distinct cookie name**, never overwrite the selected current credential. Missing, invalid, mismatched or ambiguous generation/cookie state never triggers an automatic new competitive reservation.

After a crash/abort, the successor takes the origin-wide lock, reads the persisted generation, and performs a **read-only, no-Set-Cookie** confirmation. If the cookie is absent, the generation remains pending/unverified and competitive play fails closed to practice; the successor does not mint another credential merely because the original HTTP request may have been lost. A late valid original cookie may subsequently confirm the generation. If local storage was cleared, that is treated as identity loss; a newly allocated generation uses a different cookie name, so stale responses cannot overwrite it. Browser-data deletion or malicious bypass of the lock cannot prove one-attempt-per-human, and must not be represented as doing so. Old-generation cookies must never silently be promoted into a new generation.

**Proof before admission:** deterministically stall the first Set-Cookie response, release/abort the first tab, let a second tab acquire the lock and attempt initialization for both the same and a different edition, then deliver the old response in both orders. Include tab crash, cookie-blocked mode, lost storage generation and lost HTTP response. Require either one confirmed browser identity/one reservation or practice-only admission; never two live reservations for the same retained generation. This protocol is a design requirement, not a demonstrated browser guarantee until physical Safari/Android acceptance.

### Credential-digest rotation is separate from progression-token rotation

A digest used directly as the reservation uniqueness key changes when its HMAC key rotates. Instead, create one **stable server-internal browser-identity UUID** and a versioned private digest-alias lookup of `(digest_key_id, digest) -> browser_identity_id`. Existing and new digest aliases resolve to the same internal identity; uniqueness of competitive reservations is enforced on `(browser_identity_id, exact_puzzle_id, issued_ruleset)`, never on a rotating digest. A unique alias constraint and locked identity resolution/alias creation must fail closed on conflicts or concurrent first-open races. The raw HttpOnly credential is never persisted or returned through an alias lookup.

Credential cookies carry an authenticated version/key identifier, not user-selected authority. During planned rotation, retain the old digest key through the maximum supported cookie lifetime and delayed attempt/retry grace; validate existing cookies with that key and install an active-key digest alias transactionally against the same stable identity before retiring the old key. **Never** treat an unrecognized or retired-key cookie as a missing cookie and silently create a new eligible identity. Dormant cookies whose prior digest key is no longer retained are rejected for competitive admission (practice-only) rather than mapped to a new live reservation. An emergency digest-key revocation deliberately invalidates affected credentials; it must not create new competitive cohorts. Progression-signing-key rotation and its accepted command retry window have a separate lifecycle and cannot rewrite this browser identity.

**Proof before schema:** concurrent old/new digest aliases for the same cookie resolve to one identity, exactly one reservation and unchanged historical results; simultaneous alias insertion has a single winner; mismatched identity aliases, retired/unknown key identifiers, lost cookies, expiry and emergency revocation fail closed. Verify no raw credentials in rows, logs, initial HTML or public APIs, and document concrete key-retention/renewal intervals and rollback before any migration.

### Durable reservation and separated signed authority

1. Resolve a frozen publication by immutable exact puzzle ID and its server-authoritative Pacific date. Live admission is allowed only on that edition's date; a new start after midnight is practice-only. A reservation that began live retains its originally recorded eligibility for subsequent delayed retries.
2. A service-role transaction resolves the signed cookie through a versioned, server-only credential digest lookup to one stable internal browser-identity UUID, then reserves or reads exactly one immutable attempt under a database unique key over that UUID, exact puzzle ID and points-v4 ruleset. Server-allocated attempt UUID, revision, purpose, start timestamp and canonical puzzle date are not browser choices. The title, ordered roster hash, edition display number and request fields cannot confer eligibility.
3. Use a new versioned, purpose-domain-separated signed progression envelope containing attempt ID, exact puzzle ID, date, ruleset, revision, purpose and signing key ID. Do not widen the existing primary Daily v1 token verifier into a competitive secondary authority. Verify the envelope and retained HttpOnly credential against the **stored reservation** before any score population lookup or write.
4. Both per-batter and completed results derive from the same accepted server attempt. The current fail-closed secondary guards remain enabled until the entire replacement is reviewed and released.

### One atomic, idempotent transition

Every hint or guess command has an idempotency command ID and signed predecessor revision. The server resolves it using the existing engine and exact frozen edition. One private SQL transaction row-locks the attempt, verifies its bound identity/revision and persists the accepted command, normalized successor state and sanitized retry response. Terminal at-bat observations and eventual completed points-v4 projection commit inside that **same transaction**. Score and competition key are derived from the stored attempt, never a caller-selected scorecard or roster.

An identical retry returns the already accepted response; a different command against a losing predecessor conflicts without disclosing whether a guess was correct. No losing tab may write a second eligible observation. Enforce uniqueness for (attempt ID, pitch number) and one completion per attempt; rollback must leave neither new state nor partial score projection. A signed token alone is not enough: match stored revision, idempotency ledger, browser credential and exact immutable publication on every mutation.

### Recovery, expiry and signing-key decisions still outstanding

A lost response retries its original idempotency ID, or reconciles via a cookie-authorized state read. Never reconstruct an accepted competitive score solely from local unverified facts. Delayed live attempt reconciliation after Pacific rollover is based on the stored live reservation, not on today's date or practice admission.

Use purpose-specific progression-signing keys with key IDs and a verified rotation procedure **independent** of the digest-key alias lifecycle above. A retained browser credential must support safe server-side state refresh if an old progression key expires. Before any schema change, explicitly settle the maximum raw-token retry interval, refresh grace period, cookie lifetime/renewal, lost-cookie handling and emergency rotation. Do not silently make historical accepted results mutable or reclassify an archived practice attempt as live.

### Required adversarial proof

- **Convergence:** two clean tabs, same and different editions, deterministic *old-response-after-new-lock* Set-Cookie ordering, interrupted initialization generation, no-Set-Cookie readback, lock cancellation, unavailable Web Locks, cookie-blocking, tab crash and browser reload. Require one confirmed identity/reservation or practice-only failure within a cooperating retained generation.
- **Cross-edition:** identical nine players and identical hints in two editions; swap exact ID, token, credential, attempt, date, ruleset and scored command independently. Neither aggregate may receive a relabeled fact.
- **Atomicity:** racing identical/different commands, lost-success replay, failed transaction after terminal fact, final completion failure, concurrent submit and process restart. Inspect durable rows and their actual constraints, plus old/new digest-key alias races and emergency-revocation failure.
- **Timing:** final-minute Pacific live start, delayed after-midnight completion and per-batter replay, archived practice first and cookie loss. Existing primary, Classic, archive-beta and Custom creator contexts must remain unaffected.
- **Release:** service-only grants, RLS, no answer material in HTML/bootstrap/errors/logs, signing-key retention, exact-head CI and independent reviews, isolated production-shaped QA, physical Safari/Android and explicit production approval.

**Release gate:** This proposal cannot activate score writes. Independent review must resolve the credential-convergence proof, key lifetime and transactional projection policy before any A3 submission-authority or production-schema change.
