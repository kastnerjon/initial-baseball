# Daily lineup ChatOps

Status: implementation in `feat/daily-lineup-chatops`; production activation requires explicit credential setup and QA.

## Goal

Allow the owner to provide a future Daily date and nine players in conversation and have an authorized assistant apply that exact lineup without manually editing nine slots in `/admin/daily`.

This is an operational adapter only. It does not replace the existing admin UI, lineup generator, lifecycle, validation, repository, or publication model.

## Architecture

The authoritative mutation path remains:

`assistant request -> authenticated server adapter -> Daily admin workflow -> packages/daily lifecycle -> Supabase repository`

`packages/daily` continues to own lifecycle and lineup-domain behavior. Supabase remains persistence only. The assistant must never write `daily_editorial_puzzles` directly.

The repository is public, so future lineup payloads must never be placed in GitHub issues, pull requests, commits, Actions inputs, or other public repository surfaces. GitHub is not the ChatOps transport.

The intended assistant transport is a private connected Supabase operation that makes an authenticated server-to-server POST to the production ChatOps route. Any Supabase SQL/Edge helper used for this purpose is transport glue only: it forwards the request and does not implement lineup or lifecycle rules.

## Server boundary

`POST /admin/daily/chatops` accepts a JSON object containing:

- `puzzleDate`: `YYYY-MM-DD`;
- `canonicalPlayerIds`: exactly nine unique reviewed canonical Daily candidate IDs in batting order;
- `schedule`: explicit boolean.

Authorization is a dedicated `Bearer` token from server-only `DAILY_CHATOPS_TOKEN`. The configured token must contain at least 32 characters and is compared through a timing-safe digest. Authorization occurs before the privileged Supabase repository is constructed. Successful mutations are audited as `chatops:assistant`.

The route:

1. validates the request shape;
2. ensures the requested future date has a draft record;
3. atomically replaces all nine selections through the portable Daily lifecycle;
4. reruns the existing horizon/lineup validation;
5. optionally schedules only when `schedule: true` was explicit;
6. returns the persisted date, puzzle number, status, revision, and resolved ordered selections.

Published and archived puzzles remain immutable. Replacing a scheduled future lineup returns it to draft before an explicit schedule transition. Repository optimistic-revision semantics remain intact.

## Conversational operating procedure

When the owner supplies a lineup:

1. preserve the supplied batting order;
2. resolve each name to one canonical player ID using the existing canonical search/identity system;
3. never guess through a missing or ambiguous identity; surface ambiguity and request the one needed clarification;
4. present any meaningful existing validation warnings rather than silently weakening repeat protection or eligibility rules;
5. ask whether to schedule when that intent is not already explicit;
6. submit the exact nine through the private ChatOps transport;
7. read back the persisted response and confirm date, status, revision, and all nine names in order.

Do not publish from this conversational operation. Publication remains a separate lifecycle action.

## One-time production setup

1. Connect the Supabase app to ChatGPT for the Initial Baseball project.
2. Generate one random secret of at least 32 characters outside chat. Do not paste it into a conversation or commit it.
3. Add that value to Vercel as `DAILY_CHATOPS_TOKEN` for Production (and Preview only when preview QA is desired), then redeploy so the route can read it.
4. Store the same value in Supabase Vault for the private transport helper; do not hard-code it in SQL, source control, logs, or browser code.
5. Enable/use a private server-side HTTP transport from Supabase to `https://initial-baseball-web.vercel.app/admin/daily/chatops`. The helper may retrieve the token from Vault and forward JSON, but it must not write editorial tables directly.
6. Verify unauthorized requests fail closed before performing a future-draft smoke test.

## QA gate

Before production use:

- request parser rejects malformed dates, wrong counts, duplicates, empty IDs, and implicit schedule intent;
- auth rejects absent, short, and incorrect tokens without exposing the configured value;
- full-lineup replacement is one optimistic-revision save and preserves exact order;
- unknown/non-reviewed players are rejected before mutation;
- current/past dates are rejected;
- published/archived puzzles remain immutable;
- scheduled replacement returns to draft and only explicit scheduling restores `scheduled`;
- cache invalidation still runs through the existing repository wrapper;
- the response readback exactly matches the requested nine;
- no future lineup content appears in public GitHub surfaces or browser payloads;
- full CI, documentation checks, preview deployment, and production smoke verification pass.

## Deferred

The admin UI may be redesigned later, but it is intentionally out of scope. Automatic publishing, published-puzzle correction/versioning, bulk lineup recipes, and direct assistant database writes are also out of scope.
