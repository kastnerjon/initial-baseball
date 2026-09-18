# Resolved-at-bat browser activation proof

Status: required before resolved-AB collection is described as fully browser-proven.
Date: 2026-09-18

## Goal

Verify the two remaining 6D browser guarantees against production:

1. one supported browser context owns the Daily Nine run while a second same-origin tab is a passive follower, then the follower safely takes over after owner release;
2. one genuinely fresh points-v3 run uses one identity end to end: the resolved-AB `attempt_id` and the newly created completed-result `submission_id` are the same value.

This is a production QA runbook, not a product flow or automated test replacement.

## Preconditions

- Start from current `main` and read `docs/START-HERE.md` plus `tasks/todo.md`.
- Verify the current production deployment is READY and that no newer unreviewed runtime change has replaced the 6D baseline.
- Use the canonical production host. If Basic auth is challenged, use the existing owner credentials; never copy credentials into GitHub or chat.
- Use a fresh browser profile/private window for the proof so the current Daily has no pre-existing gameplay save, attempt journal, or completed-result delivery record.
- Open both tabs inside the same browser profile/private session. Web Locks and localStorage must be shared for the two-tab proof.
- Before play, capture current row counts/latest rows for `public.daily_at_bat_results` and `public.daily_completed_results` so the test rows can be identified exactly.
- Treat all proof rows as disposable test data unless the owner explicitly wants to keep the run as a real beta result.

## A. Desktop/current-browser two-tab ownership proof

1. Open the production Daily Nine route in **Tab A**.
2. Open the same route in **Tab B** without interacting in Tab B.
3. Confirm Tab A is interactive.
4. Confirm Tab B is passive and shows the follower message:
   `This Daily is active in another tab. Close that tab to continue here.`
5. In Tab A, resolve batter 1 using **Give Up**. Wait for the reveal/terminal state.
6. Advance to batter 2 so the shared gameplay save clearly records one completed AB and the next batter.
7. Read `public.daily_at_bat_results` and record the newly created attempt ID. Expected:
   - exactly one new row for pitch 1;
   - correct current puzzle/date/number;
   - `points-v3`;
   - `resolution = 'give_up'`;
   - `awarded_points = 0`.
8. Confirm Tab B has not produced a second attempt or a duplicate pitch-1 row.
9. Close Tab A completely.
10. Return to Tab B. It should acquire ownership, discard any stale in-memory branch, and rehydrate the persisted run at batter 2.
11. Confirm Tab B becomes interactive without Reset/reload manipulation.
12. Read the database again. Expected:
    - still one attempt ID;
    - still one pitch-1 row;
    - no duplicate actor/second attempt caused by takeover.

Failure of any ownership/follower/takeover expectation blocks activation. Do not weaken the Web Lock contract to accommodate the failure; capture browser/version and investigate.

## B. Fresh completion identity proof

Continue the same Tab B run so the identity is already known.

1. Give Up on batters 2 through 9, advancing normally after each terminal result.
2. Finish the Daily and wait for the results state.
3. Read the two production tables using the captured attempt ID.

Expected `public.daily_at_bat_results`:

- exactly nine rows for the same `attempt_id`;
- pitch numbers 1 through 9 exactly once each;
- same puzzle ID/date/number and `points-v3`;
- for the all-Give-Up proof, every row has `resolution = 'give_up'` and `awarded_points = 0`.

Expected `public.daily_completed_results`:

- exactly one new points-v3 row for the same puzzle/run;
- `submission_id = <captured attempt_id>`;
- nine ordered native completed-at-bat facts;
- engine-derived zero-point summary for an all-Give-Up run.

If an older completed-result browser record existed despite the fresh-profile precondition, stop and restart with a genuinely clean profile rather than deleting/rotating its identity mid-run.

## C. Route/log verification

For the exact production deployment used by the proof:

- inspect `POST /api/daily/at-bats` logs;
- first successful delivery for each slot should normally be HTTP 201;
- an exact retry may return HTTP 200 and must not create another row;
- no 409, unexpected 4xx, or repeated retry storm is acceptable;
- inspect `POST /api/daily/results` for the terminal completion;
- run a post-proof runtime-error scan for both routes.

Do not infer database correctness from HTTP alone; authoritative row readback is required.

## D. Physical Safari check

The approved architecture also requires real Safari/device verification rather than inferring support from TypeScript or desktop Chromium.

On a physical iPhone/iPad Safari session:

1. use a fresh/private browser context on the current Daily;
2. confirm the game becomes interactive rather than falling unexpectedly into unsupported compatibility behavior;
3. resolve at least one AB and refresh/reopen the page;
4. confirm the same run restores correctly and does not mint a second attempt;
5. if practical, open a second Safari tab and confirm the follower/passive behavior before closing the owner and observing takeover.

Do not delete a real user's normal run merely to satisfy this check. If the Safari check is performed as a disposable QA run, identify rows by exact attempt ID before cleanup.

## E. Cleanup

If the desktop proof was explicitly disposable:

1. record the exact attempt ID and completed-result submission ID in the verification notes;
2. delete only rows with that exact identity from `public.daily_at_bat_results` and `public.daily_completed_results` using the connected privileged Supabase tooling;
3. never use a broad date-based delete;
4. read both tables again and confirm only the disposable proof rows were removed;
5. clear the disposable browser profile/site data.

Application repositories intentionally have no delete/upsert path for these immutable result tables; cleanup is a privileged QA operation only.

## F. Final reconciliation

After A–D pass:

- mark the two remaining browser 6D items complete in `tasks/todo.md`;
- update `tasks/plans/resolved-at-bat-browser-6d.md` with browser/version, attempt ID, deployment ID, observed row counts/statuses, identity equality, and cleanup disposition;
- update `docs/START-HERE.md` and `tasks/plans/resolved-at-bat-browser-lifecycle.md`;
- only then describe resolved-AB collection as fully browser-proven;
- comparison read/provider/API work becomes the next bounded concern.

If any proof fails, leave comparison work blocked until the browser lifecycle defect is understood and fixed.
