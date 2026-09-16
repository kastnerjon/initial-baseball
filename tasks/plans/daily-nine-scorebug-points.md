# Daily Nine scorebug points presentation

Status: Approved UI scope, September 15, 2026.

## Goal

Make the points banner answer two separate questions without duplicating scoring logic: how many points have I accumulated, and how many can I still earn on this at-bat?

## Contract

- The Points so far metric shows accumulated points only; it does not show the nine-at-bat maximum denominator.
- Current points-v3 shows a Points possible this AB metric starting at 7.
- The four metrics are ordered At bat, Points possible this AB, Points so far, Strikeouts in equal-width columns.
- Each revealed hint or wrong guess reduces Points possible this AB by 1.
- A third wrong guess or a completed at-bat shows 0 remaining for that at-bat.
- Classic, points-v2, points-v1, and legacy sessions retain their ruleset-appropriate metrics; no compatibility scoring changes.
- The completion/share surfaces continue to show the overall maximum where result context requires it.

## Ownership

The engine exposes the live allowance helper. DailyInningGame supplies current reveal/strike facts; DailyScorebug renders values only. No score is accepted from the client or recalculated in React.

## Acceptance

Focused engine and scorebug tests cover initial, hint, wrong-guess, third-strike, completed, and compatibility states. Documentation and the remaining real-device verification checklist are updated before merge.
