# Custom Lineup v2 — private admin issuance HTTP boundary

Status: scoped implementation after hosted #418; no public activation.

## Scope contract

- **Goal:** permit authenticated Daily administrators to issue v2 immutable 1–10 challenges through an explicit POST, preserving the noncompetitive same-browser creator marker.
- **Owning layer:** Web API only; reuse existing v2 private issuer, existing Daily admin auth and origin/body parsing, prebuilt version-specific signed creator marker.
- **In scope:** `/api/custom-lineup/challenges` POST; 4,096-byte JSON bound; Basic admin challenge; same-origin mutation guard; before-write creator secret check; 201 with opaque ID only and HttpOnly, scoped, SameSite=Strict, Secure-on-HTTPS v2 marker; sanitized 400/401/403/409/413/422/503 failure semantics; focused route tests.
- **Out of scope:** anonymous/public creation, browser creator UI, publishing, sharing, competitive activation, gameplay flag, database changes, new identity system, v1 modifications and engine scoring.
- **Acceptance:** no untrusted request reaches issuance before auth/origin/body/marker checks; 1/5/9/10 authorized selection bodies passed unchanged; no IDs/hints in HTTP beyond opaque challenge ID; failures set no creator cookie; marker creator admission remains ineligible. Full CI, exact-head READY Preview, independent review and after-merge verification required.
- **Stop condition:** any public exposure or identity/rate controls beyond existing admin boundary requires its own reviewed design.

## Sequencing

#418 private v2 service/read/write groundwork is already merged and hosted. This route adds an administrator-only issue capability but does not make the existing `/custom/{id}` screen accessible while `CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED` is unset. Follow with a bounded responsive 1–10 admin creator UI, then staged browser/mobile E2E and abuse/privacy controls. No public activation in this PR.
