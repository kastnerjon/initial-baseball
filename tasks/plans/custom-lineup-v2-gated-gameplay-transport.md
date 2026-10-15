# Custom Lineup v2 — gated gameplay HTTP transport

Status: PR #414, private surface staged only. Do **not** set the new environment switch during this PR.

## Scope contract
- **Goal:** provide a single disabled-by-default, same-origin, no-store HTTP transport for the already merged Custom Lineup v2 signed gameplay services, without making a playable public route or modifying stored records.
- **Owning layer:** `apps/web` Next.js API adapters.
- **In scope:** one server-only feature flag, exact v2 UUID challenge validation, four bounded attempt POST actions (bootstrap, hint, resolve, submit), same-origin mutation checks, cookie forwarding, body schemas/limits, explicit allowlist projection of terminal canonical reveal and completion status, sanitized errors, integration-like mocked HTTP tests, canonical docs.
- **Out of scope:** gameplay UI, public flag activation, challenge creation, accounts, rate limits, score comparison reads, public discovery, new DB migrations, changes to Daily/Classic/Custom Nine v1, rules or persisted schema.
- **Acceptance:** feature absent or any value other than literal `true` returns 404 before service/DB invocation; malformed credentials/bodies fail closed; every guess uses exactly one v2 atomic service (no wrong-vs-terminal oracle); accepted result reveal exposes only the terminal view model; completed bootstrap has no live token; no secrets or attempt IDs appear in reply; exact-head CI, READY preview, bounded fresh-eyes review, post-merge main/production verification.
- **Stop:** any activation, new public challenge issuance, schema/identity/score change, client/creator controls, or new abuse capability is a separate PR.

## Ownership and architecture
The existing v2 domain-specific services from PRs #411–#413 already own signed hints, wrong/correct/terminal CAS, attempt restore, and bodyless atomic admission. New routes are thin wrappers around one `serverCustomLineupV2GameplayHttp.ts` dispatch, preserving security semantics and avoiding four independent authorize/error implementations. Existing `hasUnexpectedCustomNinePostBody`, `readCustomNineJsonBody`, v2 ID validator and `createCanonicalRevealViewModel` are reused; no duplicate scoring or player lookup. POST requires exact Origin (not merely missing/foreign Origin accepted); requests with query parameters are rejected. The feature gate `CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED` is server-only, literal `true`, default off. Routes do not themselves activate Custom v2 participation.

## Security / second-order considerations
- Result mutation is never exposed independently by terminal/nonterminal guess type: `resolve` dispatches both through the same v2 CAS service, so concurrent guesses remain serialized before a distinguishable response.
- `bootstrap` reserves first attempt only when explicit flag enabled; creators only see redacted preview. Completion returns no signed future token. `submit` accepts no body and derives all awards from the durable attempt server-side.
- This gate is **not** creator-account security, anti-abuse proof, or a public rollout. If enabled without approved creator/issuance and abuse/privacy work, anonymous identities remain browser-cookie scoped, not unique humans.
- Existing Daily Nine/Classic and legacy Custom Nine routes, switches, record schemas, scoring and nine-only constraints are untouched.
- The next bounded PR is a browser transport decoder/client and responsive 1–10 player screen (or separate client and screen if size requires), with activation still gated.

## Verified predecessor
PR #413 merged `6e632f964334c990ac2d337c4f1b9589a970be3d`; exact-main CI SUCCESS, Vercel production READY, canonical routes 200, no production error/fatal logs in checked window, no open PRs, and hosted v2 RPC installed service-role-only with zero v2 issued/attempt/completed/per-batter records.
