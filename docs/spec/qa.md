# QA Spec

## Alpha readiness gates

Before wider friend alpha:

- Engine tests pass.
- Database migrations apply cleanly to dev/staging.
- Friend game can be completed end-to-end.
- Random opponent game can be completed end-to-end.
- Chat report/block works.
- League Lite create/join/standings works.
- Hints pre-populate and can be edited.
- Custom Stats Picker validates at least 1 hitter + 1 pitcher stat.
- No answer leakage to hitter before resolution.
- App can be closed/reopened without losing active games.

## Manual baseball scenario tests

- 1-inning game.
- 3-inning game.
- 9-inning game.
- Tie after scheduled innings with ghost runner ON.
- Tie after scheduled innings with ghost runner OFF.
- Sacrifice with runner on third and less than 2 outs.
- Sacrifice with 2 outs.
- Bottom-inning walk-off.
- Strikeout after configured strike count.
- Pitcher queues multiple at-bats.

## Social/safety tests

- Blocked users cannot be matched randomly.
- Reported message stores context.
- Links are blocked/disabled in chat.
- Chat can be disabled by feature flag.
- Random opponent can be disabled by feature flag.

## Regression rule

Every bug fix should add a test when the bug is in engine, validators, database logic, or Edge Function behavior.
