# ADR 0002: Custom Nine anonymous first-attempt authority

Status: Accepted for **staged implementation**, 2026-10-10. This does **not** activate competitive Custom Nine submission.  
Scope: Custom Nine points-v4 only; Universal Daily, Archive and Classic retain ADR 0001.

## Problem and decision

Existing Custom Nine progression and terminal receipts are cryptographically authentic but **stateless and replayable**. A user can select two signed branches from the same token; the #367 verifier correctly checks each branch's facts but cannot establish that the submitted sequence was the first actual play. Client-generated attempt or submission IDs do not solve that. A browser-only reset can also produce another apparently new attempt.

**Decision:** Use a private, durable, *per-issued-challenge and per-challenge-scoped anonymous browser credential* authoritative attempt ledger in Supabase. The server issues a random, challenge-specific, host-only `HttpOnly`, `Secure` (HTTPS), `SameSite=Strict`, challenge-path-scoped browser credential on the **first eligible bootstrap**, and binds its SHA-256 digest to one server-generated attempt UUID. The browser never selects the contributing attempt identifier. Reopening the same challenge with that cookie resumes the existing attempt; local Reset cannot create another eligible contribution. Each server-authorized action is monotonically committed before the next token/action succeeds.

The immutable creator-browser cookie introduced in #365 stays a separate provenance signal. A valid creator marker **or any malformed/duplicate marker** must be ineligible for competition. A missing marker does not prove the browser is not the creator; deleting cookies or switching devices circumvents anonymous eligibility. No account-grade identity, fraud resistance or unique-human guarantee is claimed.

## Atomic action and completion contract

1. Verify exact challenge ID, frozen issued puzzle and signing configuration; inspect creator marker before contribution. A newly issued attempt cookie is scoped to that exact challenge only. Never use browser-provided flags, score totals or arbitrary attempt IDs as authority.
2. For the first eligible bootstrap, insert the attempt row **only if absent** on `(challenge_id, browser_key_digest)`; simultaneous requests must read the same first winner, not replace it. Persist current signed Custom progression token, zero terminal at-bats, revision 0 and status `active`.
3. For **every scored state transition**, validate the current signed token and frozen puzzle, require both the expected token and revision from the persisted active row, and advance it with an **atomic conditional UPDATE** on challenge, browser digest, revision and current token. Only one competing branch wins; stale/replayed actions cannot advance or rewrite history. A failed conditional update must not be treated as success. Recovery may return the authoritative winner or an explicit conflict; do not silently create a new row.
4. Hints are currently shipped together with signed local reveal checkpoints. That protocol **does not prove a hint wasn't read or used**. For score-authoritative competitive Custom Nine, do not reuse free local progression as authoritative hint depth; introduce separately scoped server-recorded hint actions or explicitly downgrade scoring integrity. That decision affects browser UX and is **not implemented by this migration**. Incorrect guess strikes, Give Up, terminal events and out counts must likewise be committed server-side, not reconstructed from browser-selected branches.
5. Append validated, engine-normalized terminal facts once, in strict nine-slot order. A ninth terminal event marks the attempt completed and makes the ledger immutable to ordinary game actions. A later result-admission transaction must couple first accepted completion/result contribution atomically, not rely only on a client `submissionId`. The #367 nine-receipt verifier remains useful defense in depth, not the sole participation grant.
6. Historical stateless Custom tokens and receipts have **no persisted eligible attempt** and cannot be imported into competitive results retroactively. Existing private result tables remain isolated by challenge and version.

## Storage and security stage

The first schema stage adds only `public.custom_nine_attempt_states` with challenge FK, challenge-specific anonymous browser digest, unique server-generated attempt UUID, current signed token, revision, ordered terminal facts and active/completed timestamps. Composite primary key blocks multiple attempts by the **same retained credential** for the same challenge. Keep service-role SELECT/INSERT/UPDATE only, RLS enabled with no browser role grants or policies; no DELETE. This private mutable operational table is deliberately distinct from append-only competitive result populations.

The table and revision column **enable but do not themselves enforce** application compare-and-swap. A later separately reviewed provider service must use exact expected revision and token predicates for every update, with concurrency/race regression tests before any public action is switched to it. Do not expose this table through browser Data API access.

## Explicit limitations and tradeoffs

- A user can delete cookies, switch devices, or operate a new browser to create a new anonymous identity. This prevents account-grade single-human play and reliable cross-device creator exclusion.
- Strict authoritative hint-use proof requires a Custom-specific server-tracked hint flow and additional calls/DB writes. The current four-hint bundle already reveals all current-batter hints to developer tools; even server-tracked clicks do not prove a user didn't read them. Do not promise cheating-proof scores.
- The new ledger adds a DB operation for every server-authoritative Custom transition, unlike existing stateless Daily. Do not change Universal gameplay or the fast Daily hint UX to accommodate Custom competition.
- A database table alone does not authorize score writes; premature connection of the legacy stateless resolver or unverified result adapters is unsafe. On storage outage, fail closed for eligible contributions rather than accepting offline forged progression.
- Keeping per-challenge pseudonymous hashes rather than a global identifier minimizes cross-challenge linkage. Revisit retention/deletion policy before significant public usage; do not call the hash anonymous account identity.

## Sequenced implementation

1. **This PR:** private attempt-ledger schema, constraints, RLS and grants. No runtime adapter/routes/data inserts.
2. **Staged adapter PR:** Private web provider implements first-insert-wins, strict persisted-row decoding and conditional compare-and-swap on challenge/browser/attempt/revision/signed-current-token/active status, with concurrent stale-operation regression tests. No routes or hosted attempt inserts.
3. **Staged opt-in POST:** Distinct `/api/custom-nine/challenges/{puzzleId}/attempt/bootstrap` starts/resumes one challenge-specific signed HttpOnly browser credential and first durable attempt; verified creators preview only, invalid creator/attempt cookies fail closed. Prior stateless GET/hints/resolve remain unchanged and are never competitive evidence.
4. **Staged hint actions:** Stateful attempt hints now require prior signed token and valid challenge-only cookie, with atomic one-hint CAS and no pre-signed reveal-depth checkpoints in reserved bootstrap. The prior stateless Custom routes remain noncompetitive.
5. Next: stateful Custom guess/Give Up progression that atomically commits every scored action and rejects stale/replayed branches, preserving spoiler-safe active-batter reads.
5. Next: exact-challenge completion and result submission in a transaction preserving first eligible attempt; creator/noncreator check, engine verification, idempotent atomic inserts and comparison isolation.
6. Then: user-facing Custom game, share, and comparison UI plus public creation abuse controls. One bounded PR at a time with review and exact production verification.

## Alternatives rejected

- **Only signing more tokens/receipts:** Authentic but replayable; does not determine first play.
- **Browser localStorage/Web Locks alone:** Editable, resettable and not authoritative across requests.
- **Client-chosen submission ID or only an INSERT-ON-CONFLICT result row:** Allows another ID for the same browser/challenge and cannot distinguish a reconstructed score.
- **Global browser fingerprint or permanent cross-challenge identity:** Unnecessary tracking, weak spoof resistance, and privacy cost.
- **Moving Universal Daily/Archive to per-action persistence:** Out of scope and incompatible with their accepted noncompetitive latency model.

## Post-hint stage — server-only incorrect guess CAS

The Web-only partial guess adapter checks signed Custom active predecessor and frozen challenge, creator/attempt cookie eligibility, and uses the engine-backed Custom resolver to commit only first/second **incorrect** strikes under atomic attempt revision/current-token CAS. It does not introduce an incorrect-only public route because that would be an answer oracle; terminal correct, third-strike and Give Up are reserved for full stateful terminal service. No scoring/result admission is active, and historical stateless Custom sessions remain noncompetitive.

## Staged combined scored Custom resolve

Existing #372 first/second incorrect-guess persistence now composes with a separate terminal-only CAS service for correct, third-strike and Give-Up actions behind one bounded, cookie-authorized attempt resolve POST. Terminal HMAC receipt and signed successor verification precede a single atomic attempt-row update. A conflict never reveals the answer; the ninth fact completes the attempt. No result admission or legacy stateless route changes. Anonymous cookie deletion and external stateless hint exposure remain limitations.
