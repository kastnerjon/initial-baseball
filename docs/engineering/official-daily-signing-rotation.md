# Secondary Official Daily signing-key rotation — source-staged runbook

Release owner: issue #657. **This is not production activation or authorization to rotate a hosted secret.** Production secondary competition remains disabled. Never store the actual values of current or historical signing secrets in Git, issue comments, logs, or client code.

## Existing identity and continuity contract

An exact `daily-ed-v1-<uuid>` scoring attempt has three separate HMAC-authenticated artifacts bound to the same competitive secret: its HttpOnly edition-scoped browser credential; the outer signed competitive transcript; and the inner Daily progression token. The server also stores the canonical signed progression token. The cookie's stable SHA-256 browser digest is derived from its random nonce and immutable edition ID, not its HMAC signature. Rotation must preserve **all three** validators and the stored digest, or already-admitted attempts and scorecard readback can become inaccessible. This is unrelated to the main Daily's `DAILY_PROGRESSION_SECRET`.

## Source-controlled compatibility

The default remains one `OFFICIAL_DAILY_COMPETITIVE_SECRET`: no legacy keys accepted. When explicitly supplied, the server-only `OFFICIAL_DAILY_COMPETITIVE_LEGACY_SECRETS_JSON` must be a JSON array of at most eight distinct, untrimmed strings, each at least 32 characters and distinct from the active secret. Malformed configuration fails closed. It is a **verification-only** ring: new cookies, outer proofs and inner progression tokens are signed only with the active key; already-signed states and cookies may be verified with configured legacy keys. On a successful authenticated competitive response that verifies a legacy cookie, the route re-signs the same random nonce under the active key with the same HttpOnly, Strict, Secure and exact-edition Path attributes. The browser identity digest and database attempt ID are unchanged. No wire-format change or migration is needed.

Key removal is **revocation**, not transparent rotation. Removing an old key prevents verifying its unrefreshed browser cookies and stored attempts; do not claim that an issued competitive result is recoverable after deliberate revocation. A credential may also expire or be deleted independently of the signing key.

## Isolated Preview rehearsal before release

1. Capture isolated-QA evidence of an already-started edition and its sibling: exact puzzle ID, signed authoritative revision, completed at-bats, personal scorecard and presence of the original HttpOnly credential. Do not record raw cookies/tokens/secrets.
2. Deploy a Preview pinned to the independently reviewed source with newly generated QA active key B and prior QA key A in the **server-only legacy verification ring**. Do not change QA credentials on a branch serving unrelated tests without verifying ownership of the isolated test environment.
3. Verify the same browser credential, edition, stored token and authoritative scorecard survive the key change; the first successful authenticated request re-signs the existing cookie under B with its **original nonce and digest**. Continue an incomplete game and confirm the next token uses B; confirm the sibling's state is unaffected and default-OFF production does not expose competitive routes.
4. Test network-response loss and a competing stale tab across the boundary; if direct retries fail, confirm the browser reboots from the authoritative scorecard without accepting a second write. Do not equate a successful reload with direct retry parity.
5. Rehearse rollback to A with B retained for verification, then explicit controlled revocation of a disposable QA-only key. Verify an old credential is rejected after revocation; verify no cross-edition identity, hidden answer or signed-progression bypass.
6. Verify production-shaped selected migration and rollback, physical Safari/Android, actual Pacific midnight and all remaining #657 gates. Production secret/key changes and competitive activation require **separate explicit owner authorization**.

## Review and risk notes

- Protect the exact source commit under independent review and full CI, including no new public environment exposure.
- The ring cannot make a compromised old key harmless while retaining old-token access. Emergency revocation is a consequential security/product choice requiring explicit approval and an accepted loss-of-continuity policy.
- Previously signed in-flight retries can produce a token signed under the new key rather than the bytes of an old-key winner. First-write CAS remains authoritative, but this case requires hosted response-loss/reload acceptance before declaring operational rotation complete.
- Never infer that a source-only implementation, simulated tests or QA secret rehearsal approves production rollout.
