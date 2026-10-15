# Custom Lineup v2 — responsive admin-only creator interface

Status: bounded Web presentation PR following merged v2 admin issuer #419. **No public play activation.**

## Scope
- **Goal:** an administrator can search canonical players, select 1–10 distinct ordered players, adjust the batting order and issue a private v2 challenge, retaining an opaque issued ID.
- **Owning layer:** `apps/web/app/admin` presentation, existing client-only selection helper and page access guard.
- **In scope:** a separate authenticated `/admin/custom-lineup` route; explicit v2 configuration of existing Custom Nine editor; v2 1–10 selection validation, one empty next slot, reorder/remove, existing search and warning states, 4×N score policy unchanged, v2 admin creation endpoint, safe response ID parsing; accessibility/responsive/negative presentation tests; docs.
- **Out of scope:** public creator, public gameplay, anonymous issuance, modifying v1 Exact Nine rules, DB or engine work, changing hint/scoring, new credential system, comparison, browse/discovery, sharing, activation or title moderation.
- **Acceptance:** N=0 disabled; N=1/5/9/10 valid; 11/duplicate blocked; v1 exactly-nine unchanged; buttons and labels accessible on mobile; no answer or unearned hints in page markup; v2 server-authenticated POST sends only canonical IDs; copy opaque ID and allow explicit reset; stage under admin auth; focused tests, exact-head CI, READY Vercel Preview and independent review before merge.

## Design and second-order effects
Reuse the existing v1 workbench and its CSS rather than cloning a large component; make mode-specific behavior explicit and keep v1 defaults. Share the existing order/move/remove helpers, but raise the maximum only when v2 calls them. The authenticated v2 page uses the existing Basic admin guard. Challenge issuance itself still checks origin/admin, signs a creator marker, then persists immutable v2 clues server-side; no browser controls or signed tokens are accepted in the creator POST.

The creator marker is browser provenance only and cannot enforce person-level anti-cheat. The issued ID is not advertised as a live play URL while the default-off Custom Lineup transport flag remains unset. No environment variable, migration, hosted record, or competitive admission activation is requested.

## Next PR sequence
1. Playable flag-isolated QA against controlled v2 challenge fixtures at 1, 5, 9 and 10 batters; test refresh, score, strikeouts, atomic guesses and creator exclusion.
2. Mobile/browser screenshots and route/API security/abuse/privacy threat review; address defects in bounded follow-ups.
3. Explicit controlled activation with rollback/monitoring strategy. Only afterward exact-challenge comparisons, publish/discover and share.
