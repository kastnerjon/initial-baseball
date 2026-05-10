# Source Map

Use this to find the right file quickly.

| Change needed | Go here |
|---|---|
| Hint order/settings types | `packages/shared/src/types/gameSettings.ts` |
| Stats picker fields | `packages/shared/src/types/stats.ts` |
| Settings validation | `packages/shared/src/validators/validateGameSettings.ts` |
| Initials generation | `packages/engine/src/hints/generateInitials.ts` |
| Stats hint formatting | `packages/engine/src/hints/buildStatsHint.ts` |
| Sacrifice rules | `packages/engine/src/scoring/advanceRunnersOnSacrifice.ts` |
| Hit result by revealed hints | `packages/engine/src/scoring/getHitResultForRevealCount.ts` |
| Base advancement | `packages/engine/src/scoring/advanceRunners.ts` |
| Guess matching | `packages/engine/src/guesses/matchGuessToPlayer.ts` |
| Game settings UI | `apps/mobile/src/features/game-settings/` |
| Pitcher flow | `apps/mobile/src/features/pitching/` |
| Hitter flow | `apps/mobile/src/features/hitting/` |
| Scoreboard/box score | `apps/mobile/src/features/scoreboard/` |
| Random opponent UI | `apps/mobile/src/features/matchmaking/` |
| Game chat UI | `apps/mobile/src/features/chat/` |
| League Lite UI | `apps/mobile/src/features/leagues/` |
| Supabase schema | `supabase/migrations/` |
| Edge Functions | `supabase/functions/` |
| Player data import | `packages/baseball-data/src/` |
| Bug workflow | `docs/engineering/ai-maintenance.md` |
| Practice random player selection | `packages/engine/src/practice/selectRandomPracticePlayer.ts` |
| Practice Mode product rules | `docs/spec/practice-mode.md` |
| Practice screen | `apps/mobile/src/features/practice/` |
| Practice backend function | `supabase/functions/start-practice-round/` |


## Daily Inning web-first additions

| Need to change | Go here |
|---|---|
| Daily web landing/game shell | `apps/web/app/` |
| Daily puzzle rules | `docs/spec/daily-inning.md` |
| Daily share text | `packages/engine/src/daily/formatDailyShareText.ts` |
| Daily aggregate field stats | `packages/engine/src/daily/computeDailyPitchAggregate.ts` |
| Daily shared types | `packages/shared/src/types/daily.ts` |
| Daily puzzle DB tables | `supabase/migrations/000001_initial_schema.sql` |
| Anonymous-to-account model | `docs/spec/daily-inning.md` and `docs/spec/data-model.md` |
