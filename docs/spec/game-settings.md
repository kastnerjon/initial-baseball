# Game Settings and Negotiation Spec

## Principle

A game is not active until both players accept the same settings. Settings are negotiated before the first pitch and immutable once accepted.

## Default alpha settings

```ts
export const DEFAULT_ALPHA_SETTINGS = {
  innings: 3,
  strikesPerAtBat: 3,
  outsPerHalfInning: 3,
  extrasGhostRunner: true,
  hintConfig: [
    { slot: 1, result: 'triple', hintType: 'main_decade' },
    { slot: 2, result: 'double', hintType: 'teams' },
    { slot: 3, result: 'single', hintType: 'position' },
    { slot: 4, result: 'sac', hintType: 'stats' },
  ],
  statsHintConfig: {
    hitter: ['bwar', 'hr', 'rbi', 'ba', 'obp', 'sb'],
    pitcher: ['bwar', 'w', 'l', 'era', 'whip', 'k'],
  },
};
```

Initials-only is not in `hintConfig`; it always maps to `home_run`.

## Editable settings in alpha

| Setting | Allowed values | Default |
|---|---:|---:|
| Innings | 1–9 | 3 |
| Strikes per at-bat | 1–5 | 3 |
| Outs per half-inning | UI fixed at 3; schema supports 1–5 | 3 |
| Extra-innings ghost runner | ON/OFF | ON |
| Hint order | reorder default 4 hints | Main decade → Teams → Position → Stats |
| Stats fields | at least 1 hitter + 1 pitcher stat if Stats included | Classic stat line |

## Hint types

Alpha supports:

| Hint type | Display label | Data source |
|---|---|---|
| `main_decade` | Main decade played in | player DB |
| `teams` | Teams | player DB |
| `position` | Position | player DB |
| `stats` | Stats | formatted from selected stat fields |

Future hint types can be added without changing the scoring engine.

## Stats fields

Alpha hitter stat fields:

- `bwar` display `bWAR`
- `hr` display `HR`
- `rbi` display `RBI`
- `ba` display `BA`
- `obp` display `OBP`
- `slg` display `SLG`
- `ops` display `OPS`
- `sb` display `SB`

Alpha pitcher stat fields:

- `bwar` display `bWAR`
- `w` display `W`
- `l` display `L`
- `era` display `ERA`
- `whip` display `WHIP`
- `k` display `K`
- `sv` display `SV`
- `ip` display `IP`

If Baseball Reference WAR is used, label as `bWAR`, not generic `WAR`.

## Hint config

`hintConfig` is an ordered array of four slots.

```ts
type HitResult = 'triple' | 'double' | 'single' | 'sac';

type HintConfigSlot = {
  slot: 1 | 2 | 3 | 4;
  result: HitResult;
  hintType: HintType;
  displayLabel: string;
};
```

Rules:

- Slot 1 maps to Triple.
- Slot 2 maps to Double.
- Slot 3 maps to Single.
- Slot 4 maps to Sacrifice.
- Initials-only maps to Home Run.
- In alpha, each default hint type may appear at most once.
- No randomization by default.
- Players choose/counter the order before game start.

## Custom Stats Picker

If `stats` is in `hintConfig`:

- `statsHintConfig.hitter.length >= 1`.
- `statsHintConfig.pitcher.length >= 1`.
- Client validates before proposal/counter.
- Server validates before saving proposal/counter/acceptance.

## Proposal flow

1. Player A creates proposal from default settings.
2. Player B reviews settings.
3. Player B can accept, decline, or edit & counter.
4. The latest proposal remains pending until the other player accepts/counters/declines.
5. On acceptance, game is created/activated and settings are copied to immutable `games.settings`.

## UI copy

```text
This game's rules
3 innings · 3 strikes · Ghost runner ON

Initials only = Home Run
Hint 1: Main decade played in = Triple
Hint 2: Teams = Double
Hint 3: Position = Single
Hint 4: Stats = Sacrifice

Stats hint
Hitters: bWAR, HR, RBI, BA, OBP, SB
Pitchers: bWAR, W, L, ERA, WHIP, K
```
