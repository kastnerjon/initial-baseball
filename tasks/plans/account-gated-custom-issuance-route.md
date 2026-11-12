# Account-gated public Custom issuance and guest-draft return — scope

Goal: protect the existing default-disabled `POST /api/custom-lineup/create` with verified Supabase account authorization, preserving guest draft construction and guest friend play.

Owner: web HTTP admission boundary and client draft UX. Depends on reviewed Auth foundation #514 and single-row verified ownership storage #515.

In scope: fail closed unless existing issuance/gameplay gates AND creator authentication configuration are valid. Enforce same-origin POST and strict JSON selection; validate `getUser()` server-side before quota reservation, clue materialization or issuance; call `issueForAccount` with only the validated UUID. Return only puzzle ID, preserving the separate creator-exclusion cookie. Honor the existing IP/WAF quota as defense in depth. Preserve bounded unsaved draft in tab-scoped sessionStorage across account sign-in; reject malformed/duplicate local player records and do not store cookies/owner codes/hints.

Out of scope: migrating historical owner codes, public publication, result-account linking, My Creations, production flag enable, provider credentials or production migrations. Guest friend gameplay and immutable scoring remain unchanged.

Acceptance: unauthorized/default-off/mismatched-origin requests never reach creation quota or service; client-supplied account IDs are ignored/rejected; signed-in 1–10-player issue returns answer-free URL identity without new owner code; 422/429/500 sanitized semantics, cookie separation and manual-response-loss contract retained; draft survives page navigation in same tab and is discarded upon success. Exact-head CI, independent security review, Vercel QA and full provider/mobile acceptance before production.

Stop: Auth/ownership schema is not staged in isolated QA or protected deployment unexpectedly points at production data. No public launch without separate release gate.
