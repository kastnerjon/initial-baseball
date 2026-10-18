# Custom Lineup creator share link

## Scope contract

- Goal: An authorized v2 creator can copy/open the issued challenge's answer-free URL when the existing gameplay gate is enabled.
- Owning layer: apps/web creator presentation.
- In scope: Pass server-resolved gameplay availability to the existing admin v2 editor; a small share panel with same-origin URL, copy feedback and selectable fallback; responsive/accessibility and gating checks.
- Out of scope: Public creator authorization, abuse controls, database/API/game rules, feature activation, v1 behavior, discovery or leaderboards.
- Acceptance: Focused creator/share rendering and server flag tests; browser copy/fallback/mobile checks using mocked issuance (not hosted gameplay evidence); web checks/build and repository CI; bounded independent review and READY exact-head Preview before merge.
- Stop conditions: Any persistence or public access change requires another PR.

## Boundary

The server passes only a boolean, never a secret. The component receives the already-validated opaque issued v2 ID; it constructs a relative `/custom/{id}` path and a full URL using the current browser origin. No answers, hints, creator cookie or admin credentials enter the link. Opening in the creator browser retains preview provenance; sharing the URL does not copy cookies. Share controls are absent while gameplay is disabled, including by default. This improves the admin staging flow and does not satisfy ordinary-user creation or authorize activation.

## Verification evidence

Six focused rendering/auth/gating tests passed. A browser harness using the actual creator component and mocked search/issuance verified enabled copy feedback and exact same-origin URL, clipboard rejection with manual fallback, disabled absence of both copy-link and preview, and a 320px iframe viewport without horizontal document overflow. This is not hosted HTTP-to-Supabase acceptance. Typecheck, lint and file-size checks passed after accommodating the repository's minimal browser type declarations. One independent bounded review reported no blocking findings. Full workspace tests and production build/hidden-answer QA remain required before merge, along with exact-head CI and READY Preview.
