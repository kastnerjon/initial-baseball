# Initial Baseball PRD

## Product architecture

Initial Baseball is a baseball guessing-game platform with two surfaces:

1. **Daily Inning by Initial Baseball**: a web-first daily puzzle. Users play one inning, share initials/outcomes, and compare how the field did pitch-by-pitch.
2. **Initial Baseball H2H**: a later async multiplayer mobile app. Users play friends/random opponents, chat in games, track records, and join private leagues.

The first playable milestone is Daily Inning Web MVP.

## Daily Inning scope

Daily Inning includes:

- Mobile-friendly web game.
- No login required.
- Anonymous browser/device tracking.
- Same daily puzzle for all users.
- Computer-selected pitch sequence from seeded canonical player database.
- Initials-first guessing.
- Fixed daily hint ladder.
- Spoiler-safe share text showing initials and outcomes.
- Results page showing how the field did for each initial.
- Optional account claim path later.

Daily Inning excludes at MVP:

- Payments.
- Login requirement.
- Public comments/chat.
- H2H.
- Custom settings.
- Player-name spoilers in share text.

## H2H app scope, later

The H2H mobile app should eventually include:

- User auth and username.
- Friend games by invite link/code.
- Random opponent matchmaking.
- Game-only text chat.
- Block/report user and report messages.
- League Lite.
- Practice Mode.
- Configurable negotiated game settings.
- Custom hint order.
- Custom Stats Picker.
- Pre-populated but editable pitcher hints.
- Persistent profiles, records, head-to-head records, and league standings.

## Daily hint ladder

Daily Inning uses fixed rules for comparability:

| Guess point | Result |
|---|---|
| Initials only | Home Run |
| After Main decade played in | Triple |
| After Teams | Double |
| After Position | Single |
| After Stats | Bunt |
| Three wrong guesses | K/out |

## H2H default settings, later

| Setting | Default |
|---|---:|
| Innings | 3 |
| Strikes per at-bat | 3 |
| Outs per half-inning | 3 |
| Extra-innings ghost runner | ON |
| Triple hint | Main decade played in |
| Double hint | Teams |
| Single hint | Position |
| Bunt hint | Stats |

H2H games start only after both players accept the latest settings proposal.

## Stats hint

Alpha stat fields:

| Hitter | Pitcher |
|---|---|
| bWAR | bWAR |
| HR | W |
| RBI | L |
| BA | ERA |
| OBP | WHIP |
| SLG | K |
| OPS | SV |
| SB | IP |

If Baseball Reference WAR is used, label it `bWAR` everywhere.

## Share result

Daily share text should show puzzle number, final line, initials, and the user's outcome for each pitch. It must not reveal player names.

## Monetization

Daily Inning launches free. Monetization comes later through web ads, sponsorship, optional accounts/history, and eventual app conversion. H2H app monetization may include Pro, no ads, advanced records/settings, and private leagues.
