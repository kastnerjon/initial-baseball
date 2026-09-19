# R3 browser persistence authorization

Status: implemented on this PR; merge verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** keep shared points-v3 gameplay persistence single-writer when journal/generation preparation fails, without turning analytics ineligibility into lost gameplay availability.
- **Owning layer:** `apps/web` browser ownership and gameplay-persistence composition.
- **In scope:** distinguish lock capability from contribution eligibility; retain the Web Lock for degraded journal owners; block writes on durable-reload or unexpected lock-request failure; keep only explicit missing-capability compatibility persistence; centralize degraded-owner completion eligibility; add deterministic failure/recovery tests and reconcile canonical docs.
- **Out of scope:** R4 React re-bootstrap/effect-order fencing, mounted React dependency decisions, R5 retry scheduling, R6 save decoding, Classic ownership, leases/forced takeover, storage/schema changes, scoring, APIs, Supabase, comparison reads/UI.
- **Acceptance checks:** two corrupt-journal tabs never become simultaneous supported writers; generation write failure stays non-contributing for that owner lifetime and recovers only after later acquisition; reload failure holds exclusion until cleanup; blocked/follower/checking access cannot persist or reset; degraded owner can continue eligible completion without resolved-AB contribution; focused/full CI and Vercel preview pass.
- **Stop conditions:** any need to change Classic's compatibility model, the journal/storage format, server authority, or React test infrastructure belongs to another bounded decision.

## Authority model

The Web Lock is the gameplay-write authority. The attempt journal determines resolved-AB contribution eligibility.

- **Supported lock + healthy journal:** normal owner; gameplay persistence and eligible resolved-AB contribution.
- **Supported lock + journal/generation failure:** degraded owner; the lock remains held, shared gameplay persistence stays exclusive, resolved-AB delivery/freeze is disabled, and completion uses its existing independent identity policy.
- **Supported lock + durable reload failure:** blocked while the lock remains held; no gameplay persistence, reset, or completion creation from that state.
- **Unexpected lock-request failure:** blocked and non-writable.
- **Web Locks or abortable queue cleanup unavailable:** preserve the explicit 6C compatibility fallback; gameplay/completion remain available and resolved-AB contribution stays disabled.

A degraded owner never upgrades contribution in place when storage later recovers. Reacquisition is the next point where generation fencing can be trusted again.

## Second-order effects

Keeping the lock through journal failure prevents a recovering tab from becoming a genuine owner beside an uncoordinated writer. Keeping completion creation tied to the exclusive gameplay owner avoids adding a second completed-result writer in the supported path. Not retrying journal eligibility mid-lifetime prevents attempt/generation identity from changing underneath already-restored gameplay.

R4 remains intentionally open: React can still render an effect with captured old owner state after coordinator cleanup/re-bootstrap. That concern needs a current-authority check at the persistence write boundary and mounted rerender/StrictMode coverage, rather than expanding R3.
